---
ticket: n/a
stage: ESTIMATE
agent: tech-lead-design
produced_at: 2026-09-04T09:02:43+07:00
inputs_read:
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-009-how-a-person-becomes-a-member.md
  - .ai/registry/decisions/ADR-011-inv-01-exclusion-constraint.md
  - .ai/registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md
  - .ai/registry/decisions/ADR-024-the-seed-is-human-applied-and-converge-only.md
  - .ai/registry/decisions/ADR-026-db-sql-carries-the-target-schema.md
  - .ai/registry/features.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/tech-stack.md
  - .ai/standards/testing-standards.md
  - .ai/standards/data-model.md
  - supabase/db.sql
  - supabase/migrations/
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - package.json
consulted: []
chat_before_verdict: none
gate: n/a
blocking_reason: ""
next_state: n/a
---

# Estimate — moving off hosted Supabase

**This is an estimate, not a decision.** No `.sql` was written, no standard was touched, no ADR was
superseded, and the work has not started. Every claim below carries `file:line`; where a claim could
not be verified on this machine it is marked `TODO(verify):` rather than asserted.

The operator's question was *"what if I change from supabase to using SQLite"*. The motive was then
given as two things together: **cost / vendor lock-in**, and **wanting it to run local / offline**.
Neither *"setup is too complex"* nor *"authorization should be in TypeScript"* was chosen, so
[ADR-005](../../registry/decisions/ADR-005-authorization-in-rls.md) is **not** under attack and
nobody has asked to move authorization out of row-level security. That changes the answer, and a
fourth option is costed first because of it.

---

## 0. What was measured this run, and six corrections to the numbers I was given

Corrections are worth more than agreement, so they come first.

| Claim given | Measured | Verdict |
|---|---|---|
| `supabase/db.sql` has 16 `create policy` | 16 statements (`grep -c '^create policy'`) | **correct** |
| … 30 `grant` | **13 `grant` statements**; 45 *occurrences* of the word, 32 of them inside comments (`db.sql:286,387,454,463,473,627,629,643,644,648,653,659,671,677,684,689,744,745,895,897,898,931,936,942,948,953,954,957,968`) | **wrong — 13** |
| … 8 `revoke` | **5 `revoke` statements** — `db.sql:613,617,621,636,697`; 11 occurrences, 6 in comments | **wrong — 5** |
| … 34 `auth.uid()` | 34 occurrences, of which **28 are executable** and 6 are in comments | **refined — 28 real** |
| … 6 `auth.users` | 6 occurrences, of which **3 are executable**: the foreign key `db.sql:143`, and the trigger `db.sql:580,582`. The other three are comments (`db.sql:317,366,576`) | **refined — 3 real** |
| … 7 `create type` | **5 enums** — `db.sql:80,87,94,100,112`. The other two occurrences are comments (`db.sql:31,72`) | **wrong — 5** |
| … 4 `language plpgsql`, 5 `citext`, 2 `daterange`, 4 `int4range`, 2 `generated always`, 1 `exclude using gist` + `btree_gist`, 5 `enable row level security` | 4 / 5 / 3 / 4 / 2 / 1 / 5. `daterange` is 3, not 2 (`db.sql:184` comment, `db.sql:190` twice on one line) | **correct, one off by one** |
| Seam is 2,232 lines across three files, 399 / 850 / 983 | Exactly right. `wc -l` confirms | **correct** |
| Seam is *"~24 operations"* | **19** methods on `DataSeam` (`src/lib/data/index.ts:91-375`) | **wrong — 19, and that is good news** |
| `supabase.ts:174` is the **only** Auth call | **Seven call sites.** `auth.getUser` at `:174` and `:692`, `auth.signUp` at `:316`, `auth.getSession` at `:573`, `auth.onAuthStateChange` at `:590`, `auth.signInWithPassword` at `:607`, `auth.signOut` at `:620` | **wrong — but the conclusion drawn from it is still right, see §4** |
| Nine shipped features | **Eight** feature rows at `DONE` — CAL-01, CAL-02, CAL-03 (`features.md:88,89,90`) and TEA-01 … TEA-05 (`features.md:117,118,119,120,121`). Nine shipped *tickets* if OPS-001 is counted (`.ai/board/backlog.md:206`) | **wrong — 8 features / 9 tickets** |

Two further corrections that the brief did not raise and that change the cost of one option
materially:

- **`.ai/standards/tech-stack.md:84` and `:189-191` are stale.** They say the Supabase CLI is *"not
  installed"* and on the *past reliable recall* list. It **is** installed:
  `package.json` devDependencies carries `"supabase": "^2.116.0"`,
  `node_modules/supabase/package.json` resolves it to `2.116.0`, and `pnpm exec supabase --version`
  prints `2.116.0`. That file is standards plane and human-owned, so this is recorded here rather
  than corrected — it is a `TODO(project)` for a human, not an agent edit.
- **`supabase/config.toml` does not exist.** `ls supabase/` returns `db.sql`, `migrations`,
  `seed.sql`, `.temp` and nothing else. `supabase init` has never been run in this repository.

---

## 1. The finding, and the part of it that is wrong

The framing I was asked to structure around was: *SQLite is not a datastore swap; it removes
authorization, authentication and INV-01's enforcement, and forces a server into existence.*

**Three quarters of that is right, and the INV-01 quarter is wrong.** Taking them in order.

**Authorization — the finding holds, and it is the load-bearing one.** SQLite has no row-level
security, no `GRANT`, no roles, and no session identity. There is nothing for `db.sql`'s 16 policies
(`db.sql:711-916`), 13 grants and 5 revokes to be expressed as. The nearest SQLite mechanism,
`sqlite3_set_authorizer`, is a C callback invoked at statement-compilation time and decides at
table and column granularity; it cannot see a row and cannot be written in SQL. **28 executable
`auth.uid()` references** disappear with no equivalent, because SQLite has no concept of *who is
asking* — a connection is a file handle, not a principal.

**Authentication — the finding holds.** `member.id` is `uuid primary key references auth.users (id)
on delete restrict` (`db.sql:143`), and
[ADR-009](../../registry/decisions/ADR-009-how-a-person-becomes-a-member.md) makes membership a
trigger on `auth.users` (`db.sql:580-582`, `after insert or update of email_confirmed_at`). Both
point at a table SQLite does not have and cannot grow, because authentication is a service, not a
schema. `email_confirmed_at` in particular is GoTrue state, not application state.

**The server — the finding holds, and it is worse than stated.** ADR-005 § Context is explicit:
*"there is no server component and none is planned"*, and `.ai/standards/architecture.md:70-72`
draws the layer diagram ending at *"Supabase — PostgREST, Auth, PostgreSQL"*. SQLite is a library
that opens a file. A browser cannot open a shared file, so there are exactly two shapes:

- **SQLite in the browser (wasm + OPFS).** Each person gets their own database. CaleChip is *"a
  planning board on which every member of one team declares … so the team can see a crowded day"*
  (`CLAUDE.md`). A per-device database is not a slower version of that product; it is a different
  product with no shared board. This shape is not costed below because it does not satisfy the
  charter.
- **SQLite behind a process you write.** Then a server exists, it owns the file, and it must hold
  every check that the 16 policies hold today — because the actor id can no longer come from a
  signed token the database itself verifies; it comes from whatever the caller says it is.

**INV-01 — the finding is wrong, and I verified the refutation rather than reasoning about it.**
See §2.

---

## 2. Where SQLite wins, stated plainly

### 2.1 INV-01 is holdable in SQLite, in the database, and I ran it

`.ai/standards/data-model.md:159` calls INV-01 *"the one a read-then-write check cannot hold"*, and
`.ai/standards/architecture.md:108` gives the reason as *"two tabs, two devices, or a retry defeat
it, and only the database sees both writes."*
[ADR-011](../../registry/decisions/ADR-011-inv-01-exclusion-constraint.md) refused the seam-level
check on exactly that ground.

**That ground is a statement about PostgreSQL's concurrency, not about invariants in general**, and
SQLite does not share it. Two SQLite properties combine:

1. **`GENERATED ALWAYS AS … STORED` exists** (SQLite 3.31+; this machine runs `3.51.0`, verified by
   `sqlite3 --version`). ADR-011's `int4range` slot mapping — `full → [0,2)`, `am → [0,1)`,
   `pm → [1,2)` (`db.sql:194-199`) — becomes two generated integer columns, `slot_lo` and
   `slot_hi`, and `&&` becomes `a.lo < b.hi AND b.lo < a.hi`.
2. **A `BEFORE INSERT` trigger with `RAISE(ABORT, …)` runs inside the writing statement's own
   transaction**, and SQLite allows **one write transaction per database file at a time**. There is
   therefore no window between the scan and the insert for a second writer to occupy.

Verified by running it, not by recalling it. Against a throwaway database on this machine, with
generated `slot_lo`/`slot_hi`, a `CHECK (portion in ('full','am','pm'))`, a
`CHECK (end_date >= start_date)` and one `BEFORE INSERT` trigger, all four rows of ADR-011's
correctness table behave correctly:

| Case | ADR-011 §3 requires | Observed |
|---|---|---|
| `am` then `pm`, same member, same day | allowed | allowed |
| `full` overlapping an existing `am` | refused | `Error: overlapping_entry (19)` |
| another member, same dates, `full` | allowed | allowed |
| adjacent dates, no intersection | allowed | allowed |
| `end_date` before `start_date` | (ADR-011 records nothing enforces this today) | `CHECK constraint failed` — **closed for free** |

And the concurrency claim itself, verified: connection A in `BEGIN IMMEDIATE` holding an uncommitted
insert; connection B issuing the conflicting insert with a 300 ms busy timeout. B returns
`Error: database is locked (5)` and its row is absent afterwards. **SQLITE_BUSY is loud.** It is
never a silent lost update, which is the failure mode ADR-011 was defending against. This answers
the question I was asked to work out: **yes, a transaction-scoped scan holds INV-01 under SQLite's
locking** — and the trigger form is strictly better than a seam-level scan, because it holds against
every writer of that file rather than only against the code paths that remember to scan.

**Two caveats, and they are the honest part.** First, the single-writer guarantee is a property of
*one file on one machine's filesystem*; it does not survive a replicated libSQL/Turso deployment,
and it is unreliable over NFS or SMB, where SQLite's own documentation warns that advisory locking
is not dependable. Second, the constraint stops being *declarative*: today the exclusion constraint
also **is** the index that serves the calendar's overlap read (ADR-011 §2), and under SQLite you get
an ordinary index plus hand-written overlap arithmetic — the same semantics restated in a second
place, which is precisely what ADR-011 §2 argued against, except now there is no first place for it
to disagree with.

### 2.2 The other conversions are real and cheap

- **The 5 enums → `CHECK (col IN (…))`.** `db.sql:80,87,94,100,112`. Verified working above. Loses
  the type, keeps the constraint.
- **`citext` → `COLLATE NOCASE`.** One use, `allowed_email.email` (`db.sql:156`), and `db.sql:340`
  records why it exists: *"citext, so the comparison is case-insensitive without a lower()
  anywhere."* `COLLATE NOCASE` gives the same, with the well-known ASCII-only caveat — irrelevant
  for an email local-part, and Vietnamese diacritics do not appear in addresses.
- **`daterange`/`int4range` → four integer or ISO-text columns.** `end_date` is inclusive
  (`data-model.md`), so ADR-011's `'[]'` constructor footgun and PostgreSQL's `[)` canonicalisation
  (ADR-011 §1) both **disappear**. That is a genuine simplification: a class of silent off-by-one-day
  bug goes away.
- **`now()` → `CURRENT_TIMESTAMP`.** Mechanical.

### 2.3 The triggers — which clauses port, verified clause by clause

This was asked specifically, so it is answered clause by clause rather than in aggregate.

**`public.entry_enforce_decision()`** (`db.sql:456-546`) has three labelled clauses:

| Clause | What it does | Ports to SQLite? |
|---|---|---|
| (a) the admin guard | refuses a move of `status`, `rejection_reason`, `approved_by`, `approved_at` by a non-admin. Reads `v_uid := (select auth.uid())` (`db.sql:459`) and `public.is_admin(v_uid)` | **No.** It is authorization, and its whole input is `auth.uid()` |
| (b) provenance | writes `approved_by := v_uid` and `approved_at := now()`, *"never trusted from the wire"* (ADR-016 §2) | **No.** Same reason. `approved_by` is the only audit trail v1 has (`rbac-and-security.md:155-158`), and under SQLite it would have to be supplied by the caller — i.e. forgeable, which is the exact thing ADR-016 §2 exists to prevent |
| (c) INV-02 | resets `status`, `approved_by`, `approved_at`, `rejection_reason` when `start_date`, `end_date`, `type`, `portion` or `tentative` change. **Actor-blind on purpose** (ADR-016 §2) | **Yes.** A `BEFORE UPDATE … FOR EACH ROW` trigger comparing `OLD` and `NEW` is a direct port |

So **INV-02 ports and INV-03 ports** (INV-03 is a plain biconditional `CHECK`, `data-model.md:162`).
The `RAISE(ABORT)` mechanism the brief asked about is sound for both. What does not port is the two
clauses that are not invariants at all — they are the authorization ADR-016 put in a trigger only
because an RLS `with check` cannot see the OLD row (`rbac-and-security.md:170-186`).

**`public.member_enforce_role_and_removal()`** (`db.sql:380-427`) has five clauses. Four are
actor-blind and port directly: no demotion (`db.sql:390`), no promoting a removed member
(`db.sql:396`), removal is one-way (`db.sql:402`), and `removed_at := now()` written by the
database (`db.sql:422`). **One does not port**: *"an admin may not remove themselves"* at
`db.sql:414-417`, whose test is `old.id = v_uid`.

**`public.admit_allow_listed_member()`** (`db.sql:318`) does not port **at all**: its trigger is
`after insert or update of email_confirmed_at on auth.users` (`db.sql:582`), and neither the table
nor the column exists outside GoTrue.

**Summary of the trigger surface:** of 3 triggers and 6 functions, the *integrity* half ports
cleanly and the *identity* half does not. That split is the estimate in miniature.

---

## 3. Separating the two dependencies

These are being conflated, and separating them is the most useful thing in this document.

| Dependency | On what | Where it lives | Breakable alone? |
|---|---|---|---|
| Row-level security, 16 policies, 13 grants, 5 revokes, `exclude using gist`, `btree_gist`, ranges, `plpgsql` | **PostgreSQL.** Not Supabase | `db.sql:57-698`, `db.sql:711-916` | **Yes** — any PostgreSQL runs it |
| `auth.users`, `auth.uid()`, `email_confirmed_at`, JWT issuance, session persistence | **GoTrue**, Supabase's auth service | `db.sql:143,580,582`; `src/lib/data/supabase.ts:174,316,573,590,607,620,692` | **Yes, but not cheaply — see below** |
| PostgREST wire protocol (`.select()`, `.maybeSingle()`, `42501`, `23P01`, `PGRST301`) | **PostgREST** | `src/lib/data/supabase.ts:195-290` and every method | Yes — it is one open-source binary |

Note the middle row's asterisk, because the coordinator's framing — *"only Auth is replaced"* —
**understates it**. The RLS model does not depend on GoTrue's UI or its emails; it depends on
GoTrue's *contract*: a table named `auth.users` that `member.id` can reference, and a function
`auth.uid()` returning a claim out of a JWT that PostgREST already verified. Replacing GoTrue while
keeping ADR-005 means reimplementing that contract — a users table, a password hasher, a token
issuer, a signing key PostgREST trusts, refresh-token rotation, and email confirmation. At which
point you have rebuilt the component you removed. The **7 call sites** in the seam are the cheap
part; the schema contract underneath them is not.

**One thing the seam genuinely buys you, and it is the best news in this document.** `mock.ts` is
983 lines and is already a *complete, working, non-Supabase implementation of all 19 operations*,
including hand-reproduced policy predicates (`mock.ts:281-347`, INV-01 at `:304` and `:722`,
`member_team_id` at `:311`, the admin test at `:339`). The seam-parity test
(`tests/seam-parity.test.ts`) binds it to the real one. So **the shape of a second backend is proven
and the contract is fixed.** What `mock.ts` does *not* prove is the thing that matters: its checks
run in one process with no adversary, so they are affordances, exactly as
`.ai/standards/architecture.md:93-95` says every seam-level check is. Porting `mock.ts` to a server
gives you working code; it does not give you a control, until that server is the only thing holding
the file and the caller cannot supply its own actor id.

---

## 4. Option 0 — self-host the Supabase stack itself

Costed first because it is the only option that serves **both** stated motives at close to zero
architectural cost, and because it does not decide anything irreversible.

### 4.1 Does the claim hold up? Tested, not assumed.

**Q1: does the local stack give the same `auth.*` surface the seam calls?**
`pnpm exec supabase start --help` lists the containers it starts, by name, in its `--exclude` flag:
`[gotrue, realtime, storage-api, imgproxy, kong, mailpit, postgrest, postgres-meta, studio,
edge-runtime, logflare, vector, supavisor]`. **GoTrue and PostgREST are both there.** The generated
config carries `[auth] enabled = true` (`config.toml:155`).

All seven seam call sites use the **ordinary** client, not the admin surface:
`signUp` (`supabase.ts:316`), `signInWithPassword` (`:607`), `signOut` (`:620`), `getUser`
(`:174`, `:692`), `getSession` (`:573`), `onAuthStateChange` (`:590`). ADR-009 § Context already
established that the admin surface is deliberately unused — *"`inviteUserByEmail` is declared on
`GoTrueAdminApi` … `signUp` is not on that surface at all"*. `onAuthStateChange` and `getSession`
are client-library behaviour over `localStorage` and are unaffected by which GoTrue answers. **The
client library does not change; only `VITE_SUPABASE_URL` does.** `supabase.ts:40-41` reads it from
the environment and `supabase.ts:50-54` constructs the client lazily, so nothing in `src/` is edited.

**Answer: yes — with one measured difference that will bite on day one.**
`config.toml:225` ships `enable_confirmations = false` under `[auth.email]`. TEA-01 AC-7 requires
**Confirm email on** — `mock.ts:390` says so verbatim (*"AC-7 requires Confirm email on, and under
that setting signUp returns no session"*), and `supabase.ts:316-330` branches on exactly that. With
the default, `signUp` returns a live session, `needsEmailConfirmation` is false, and TEA-01's
end-to-end assertions fail. **One line in `config.toml`**, but it must be in the plan, not
discovered. In compensation, `mailpit` is in the container list, so with confirmations on the
confirmation email is *actually testable locally* — which it is not against a hosted project with
no inbox.

**Q2: does `supabase/db.sql` apply unchanged?**
The apply mechanism already takes an arbitrary connection string —
ADR-024:59-60 records *"`supabase db query --file <path> --db-url <conn>` … both take one"*, and the
local database listens on `port = 54322` (`config.toml:34`). Separately,
`[db.migrations] enabled = true` (`config.toml:60`) and
`[db.seed] sql_paths = ["./seed.sql"]` (`config.toml:65-70`) mean the seven files in
`supabase/migrations/` and `supabase/seed.sql` are applied automatically on `supabase db reset`,
with no new command to learn.

On the three specific risks raised, the generated config **answers two open `TODO(verify)` markers
that have been outstanding since 2026-08-31**:

- **`btree_gist` and `citext` in the `extensions` schema.** `db.sql:57` and `db.sql:66` create both
  `with schema extensions`. ADR-011 §4 flagged as unverified *"into which schema it is created …
  that schema must be on the `search_path` in force when the constraint is created."*
  `config.toml:15` reads `extra_search_path = ["public", "extensions"]`. **On the local stack it is,
  by default.** ADR-011's marker is answerable for the first time.
- **The PostgreSQL major.** `config.toml:41` reads `major_version = 17`. ADR-011 and
  `tech-stack.md:82,189-191` both record this as unknown. Postgres 17 has `daterange`, `int4range`,
  `generated always … stored`, `exclude using gist` and `btree_gist` — nothing in `db.sql` is at
  risk.
- **The `auth.users` foreign key and the trigger on it.** GoTrue runs against the *same* Postgres
  container, so `auth.users` exists and `db.sql:143`'s reference resolves. The trigger at
  `db.sql:580-582` is created by a local superuser rather than needing a hosted project's grant —
  **likely easier than hosted, not harder** — and it is the one place `db.sql:317` already says
  *"Confirm against `\d auth.users` before this is applied."*

**Answer: yes, with high confidence — but `TODO(verify):` on first apply, because it cannot be run
on this machine.** See §4.2.

### 4.2 The Docker prerequisite is real, and it is measured

`which docker podman colima orbstack` → **all four absent.** `/Applications` contains no Docker
Desktop, OrbStack, Podman Desktop or Rancher. The CLI names the prerequisite itself, in its own
words:

```
pnpm exec supabase status
{"linked_project":null,"_tag":"Error","error":{"code":"LegacyStatusDbInspectError",
"message":"failed to inspect container health: docker: command not found (podman also not found)
 — install Docker Desktop or Podman and ensure it is on PATH"}}
```

So the local stack is **not free**, and this is its own line in the estimate, not a footnote:

- **Install a container runtime.** Homebrew is present (`/opt/homebrew/bin/brew`), so the install
  itself is short. The decision attached to it is not: **Docker Desktop requires a paid subscription
  for companies over the size threshold in its licence**, which is directly adverse to a *cost*
  motive. Podman and Colima are free and OCI-compatible, and the CLI names Podman explicitly in the
  error above. **That is an operator decision, not an engineering one**, and it belongs in whatever
  ADR follows.
- **Disk and memory.** The stack is ~13 containers. On a laptop that is real, recurring cost.

This is also the one place the *offline* motive is only partly served: the first `supabase start`
pulls images and needs a network. After that it runs offline.

### 4.3 The cost

| Work | Days | Anchor |
|---|---|---|
| Install and choose a container runtime | 0.5 | Machine-measured absent. Brew install is minutes; the Docker-Desktop-licence decision is the cost |
| `supabase init` — writes `config.toml`, which does not exist today | 0.25 | Verified: runs without Docker, produces exactly one file |
| Reconcile `config.toml` to the hosted project's settings | 0.25 | **One** measured mismatch found (`enable_confirmations`, `config.toml:225`). Budgeted for two more |
| `supabase start` + `db reset`; first-run failures | 0.5–1 | 7 migrations + `seed.sql` auto-apply. Unknown unknowns on a 13-container first run |
| Repoint `.env.local` | 0.1 | **Zero source changes.** `supabase.ts:40-41,50-54` |
| Re-verify the 8 shipped features | 2–3 | See §7 |
| **Local development only** | **≈ 4 days** | |
| *If it must also be the shared, always-on board* | **+4–8** | A host, TLS, backups, upgrades, and a permanent operations cost that a hosted project absorbs today |

**ADRs superseded: zero. Standards rewritten: zero.** One `TODO(project)` in
`tech-stack.md:82` becomes answerable (Postgres 17, `config.toml:41`), and `tech-stack.md:189-191`
needs the stale CLI sentence corrected — both are fill-ins a human makes under RULE-01, not
rewrites. `supabase/db.sql`, all 7 migrations, all 16 policies, the exclusion constraint, the seam
and every test apply **as-is**. ADR-005, ADR-009, ADR-011 and ADR-016 are all untouched.

**One thing to be honest about.** `supabase start` is not really an *alternative* to Supabase; it is
**the local development mode of the thing already chosen**, and it is free. It answers "cost" and
"lock-in" in the sense that matters — the schema, the policies and the client all run on open-source
components you can host yourself, and that is true *today*, before any migration. What it does not
by itself answer is *where the team's shared board lives*, which is §8's question.

---

## 5. Option 1 — Supabase → SQLite (what was asked)

### 5.1 What has to exist that does not exist now

`src/` holds 20 files and every one of them is client-side. There is no server anywhere in this
repository, and ADR-005 § Context says *"none is planned"*. So:

1. **A server process.** Node + `better-sqlite3` or libSQL. New dependency, so **check R9 requires an
   ADR** (`tech-stack.md:197`), and a new deployment target where `tech-stack.md:155-159` currently
   has an open `TODO(project)` for a *static* build.
2. **An HTTP API for 19 operations** (`index.ts:91-375`). Every one of them today is a PostgREST
   call whose failure semantics the seam already depends on in detail — `23P01` → `overlapping_entry`
   (`supabase.ts:261`), `42501`/`PGRST301` → `not_permitted` (`supabase.ts:234-235,278-279`), and the
   *"zero rows is a refusal, not success"* rule that `index.ts:190-194,314-316,333-337` repeats three
   times. All of that is re-specified.
3. **An authentication service.** Password hashing, sessions, refresh, email confirmation, and the
   `email_confirmed_at` transition ADR-009's trigger depends on (`db.sql:582`). Written from scratch
   is the single largest ongoing correctness liability in this option — it is the class of code where
   a subtle error is a breach rather than a bug.
4. **Authorization in TypeScript, on the server.** All 16 policies, all 28 `auth.uid()` sites, plus
   the four trigger clauses from §2.3 that do not port. **The operator explicitly did not ask for
   this** — they did not choose *"want authorization in TypeScript instead of RLS"* — and it arrives
   anyway, as an unavoidable consequence.
5. **A sharing story for a file.** One machine, one file, one writer. That is what makes §2.1's
   INV-01 proof work, and it is also the ceiling on how the board is served.

### 5.2 What survives

`mock.ts` (983 lines) survives conceptually and is the best asset in the repository for this option.
`index.ts` (399 lines) survives almost unchanged — the contract is the contract. `supabase.ts`
(850 lines) is replaced by an HTTP client of similar size. The seam-parity test still binds them.
The `Result`/`FailureCode` vocabulary in `src/lib/domain/types.ts` survives.

### 5.3 The cost

**15–30 engineering days.**

**Anchored on:** 16 policies + 6 functions + 3 triggers + 5 tables + 5 enums (all counted in
`db.sql`) to re-express; 19 seam operations (`index.ts`) to re-serve; 850 lines of seam to rewrite
and 983 to relocate; 7 Auth call sites over a service that must be built; 8 shipped features
(`features.md`) and 6 e2e spec files (`tests/e2e/`) to re-verify; plus a server, an HTTP layer and an
auth service, **none of which has any prior art in this repository** — `src/` is 20 client files and
`supabase/migrations/` is 7 SQL files. The lower bound assumes the seam contract holds without
change and `mock.ts` ports cleanly. The upper bound assumes it does not, which is the normal outcome
when authorization moves layer.

The range is wide on purpose. A narrower one would be false precision on the only option that
contains a component nobody here has written before.

---

## 6. Option 2 — self-hosted PostgreSQL without GoTrue

ADR-005 survives; PostgREST survives; the 16 policies, the exclusion constraint and the three
triggers all survive. Only authentication is replaced.

**8–15 engineering days.** **Anchored on:** the same 8 features and 6 e2e files to re-verify (2–3
days, §7), plus the GoTrue *contract* rebuild described in §3 — an `auth` schema with a `users`
table `db.sql:143` can reference, an `auth.uid()` that reads a JWT claim PostgREST verifies against
a shared signing key, password hashing, refresh rotation, and the `email_confirmed_at` transition
`db.sql:582` fires on. The 7 seam call sites are the small end of that.

**This option is dominated by option 0** unless GoTrue specifically is the objection, and nobody
said it was. It is costed because it is the honest fallback if the 13-container stack is rejected for
its size — but note that the fallback is *"write the auth service yourself"*, which is the expensive
half of option 1 without option 1's benefits.

---

## 7. Option 3 — stay

**0 days of migration.** Serves **neither** stated motive: the project stays hosted, and nothing runs
offline.

It is costed anyway because it makes visible a debt that **every option above also owes**, and which
should not be attributed to whichever migration happens to surface it:

- **The permission-model test does not exist.** `testing-standards.md:104-109` calls it one of *two
  mandatory unit tests* — *"every role, every action, both directions — including the denials"* — and
  leaves `TODO(project)` for its path. `tests/` contains exactly two files, `seam-parity.test.ts` and
  `ui-language.test.ts`. Neither is it. `rbac-and-security.md:143-148` names this as known weakness 1
  and says in terms that *"the only thing that catches it is the permission-model test."* **Today,
  nothing catches a fail-open policy.**
- **MD-021.** `testing-standards.md:38-41`: the e2e suite *"does not pin which seam it drives"*, so
  it resolves to Supabase whenever a `.env` carrying `VITE_SUPABASE_URL` is present and **drives the
  live project**. `tests/e2e/seam.setup.ts` exists and may already address this — `TODO(verify):`
  re-run and correct that table either way, which the same file at `:43-44` already asks for.

**Debt: 2–3 days**, owed under every option including this one.

---

## 8. Re-verification of the shipped work

Included in each number above. It is 2–3 days, and the same 2–3 days each time.

**Anchored on:** 8 feature rows at `DONE` (`features.md:88,89,90,117,118,119,120,121`), 6 end-to-end
spec files (`tests/e2e/cal-01…`, `cal-02…`, `cal-03…`, `tea-01…`, `tea-05…`, `smoke`), 2 unit test
files, and 4 Definition-of-Done commands (`testing-standards.md:16-19`).

It is the same figure for options 0 and 3 because nothing above the datastore moves. It is the same
*figure* for options 1 and 2 but not the same *work*: there, the permission-model test cannot be
carried over at all, because `rbac-and-security.md:88-89` says the check runs *"in row-level security
policies, and nowhere else"*, and under option 1 that sentence is false. The test would have to be
written against a layer that does not exist yet — which is why it sits inside the 15–30, not beside
it.

---

## 9. The documentation cost, named honestly

### 9.1 ADRs superseded

| Option | ADRs superseded | Of which need the **operator's own decision** under RULE-01 |
|---|---|---|
| **0 — self-host Supabase** | **none** | none |
| **3 — stay** | none | none |
| **2 — self-hosted PG, no GoTrue** | ADR-009 | **ADR-009 (`ACCEPTED by the operator`)** |
| **1 — SQLite** | ADR-005, ADR-009, ADR-011, ADR-014, ADR-016, ADR-018, ADR-020, ADR-024, ADR-026 | **ADR-005, ADR-009, ADR-014, ADR-020, ADR-026 — all five `ACCEPTED by the operator`** |

Status lines verified individually. `ACCEPTED by the operator`:
ADR-005, ADR-009, ADR-014, ADR-020, ADR-026 (and ADR-006, ADR-007, ADR-008, ADR-012, ADR-013,
ADR-019, ADR-022, ADR-023, not in scope here). `ACCEPTED by tech-lead-design`: ADR-011, ADR-016,
ADR-024. `ACCEPTED by steward`: ADR-018.

**Under ADR-008 an agent may accept an ADR that decides *inside* an existing envelope and must ask
rather than decide when it would supersede or reverse an accepted one** (ADR-011 § Status states
this). Option 1 reverses five operator-accepted decisions, so **five human decisions are a
precondition, not a deliverable** — they are not in the 15–30 days, they precede them. ADR-005's own
revert condition (`ADR-005:89-94`) is *"the first permission requirement that cannot be expressed as
an RLS policy without duplicating the rule in application code"*, and **a datastore with no policies
does not meet that condition** — it moots it. Superseding ADR-005 for this reason is a decision the
ADR did not anticipate, which is exactly why it cannot be an agent's.

### 9.2 Standards rewritten

- **Option 0:** none. Two `TODO(project)` fill-ins in `tech-stack.md:82,189-191`.
- **Option 2:** `rbac-and-security.md` § Authentication (`:103-114`) and § Secrets (`:116-135`);
  `tech-stack.md` Datastore (`:78-100`); `data-model.md` § Migrations (`:172-181`).
- **Option 1:** all of the above **plus** —
  - `architecture.md` — § *Where authorization lives* (`:82-99`) deleted and rewritten, § *Layers*
    (`:59-80`) redrawn to include a server, § *Where invariants live* (`:101-118`) re-tabled,
    § *The data-access seam* (`:15-57`) re-pointed, § *Boundaries the audit enforces* (`:120-129`)
    replaced together with the `supabase-client-in-seam` boundary in
    `.ai/registry/boundaries.json` **and check D12 with it**;
  - `rbac-and-security.md` — § *Where the check runs* (`:86-101`), and **all seven known weaknesses**
    (`:137-193`) re-derived, since every one of them is a statement about RLS or about a public anon
    key;
  - `data-model.md` — § *Where invariants are held* (`:151-170`) rewritten row by row, every column
    type restated;
  - `testing-standards.md` — the permission-model test's level (`:104-109`);
  - `tech-stack.md` — Datastore, *Interface between the parts* (`:102-106`), *Build and deployment*
    (`:155-159`), and the *Versions the model cannot recall* table;
  - `integrations.md`;
  - `.ai/00-charter.md` **if** the SQLite-in-the-browser shape is ever chosen, since it ends the
    shared board.

Every one of those files is standards plane — human-owned, CODEOWNERS-reviewed — and
`tech-stack.md:205-207` says an agent needing a change there **stops with `gate: BLOCKED`**.

---

## 10. Ranking, against the motives actually given

| Rank | Option | Days | Serves *cost / lock-in* | Serves *local / offline* | ADRs superseded |
|---|---|---|---|---|---|
| **1** | **0 — self-host the Supabase stack** | **≈ 4** local; **+4–8** if it also becomes the shared board | **Yes** — all open source, no hosted bill, no proprietary component | **Yes** — after the first image pull | **0** |
| 2 | 3 — stay | 0 (+2–3 debt) | No | No | 0 |
| 3 | 2 — self-hosted PG, no GoTrue | 8–15 | Yes | Yes | 1 (operator) |
| 4 | **1 — SQLite** | **15–30** | **No better than option 0** — both are free and unhosted | Yes | **9, five of them operator's** |

**SQLite is ranked last on its own merits, not by redirection.** It genuinely serves local/offline.
It buys **nothing** on cost or lock-in that option 0 does not already give for a fraction of the
work — both are free, both are self-hosted, neither has a vendor — and it charges for that nothing by
destroying the authorization model, forcing a hand-written auth service into existence, and requiring
five operator decisions before a line is written. Its one real technical win, INV-01 under
single-writer locking (§2.1), is a genuine and verified result and it is not worth 15–30 days.

**Recommendation, one sentence:** run `supabase start` locally — it satisfies both stated motives for
about four days of work with zero ADRs superseded and zero source changes — and treat *where the
shared board lives* as the separate, later decision it actually is.

---

## 11. What I would need from the operator to make a recommendation stick

The motive question is answered, so one input is left, and it is the one that separates 4 days from
12:

> **When you say "local", do you mean the developer's machine, or the place the team's shared board
> actually lives?**
>
> - **The developer's machine** — option 0, about four days, nothing in `.ai/registry/` or
>   `.ai/standards/` changes, and the hosted project can stay or go independently and later.
> - **The team's shared board, on hardware we own** — option 0 plus a further four to eight days and
>   a permanent operations cost (a host, TLS, backups, upgrades) that the hosted project absorbs
>   today. The architecture is still unchanged; the running of it is not.

They are not the same request, they cost roughly three times apart, and only the second one is a
decision about the product rather than about the workflow.

---

## Open questions

1. `TODO(verify):` **`supabase/db.sql` applying to the local stack.** Every input points to yes —
   Postgres 17 (`config.toml:41`), `extensions` on the search path (`config.toml:15`), GoTrue on the
   same database — but it could not be run here, because no container runtime is installed. **This
   is the first thing to do and it costs an hour.**
2. `TODO(verify):` **the container runtime choice.** Docker Desktop carries a commercial licence
   above a company-size threshold, which is adverse to a cost motive; Podman and Colima are free and
   the Supabase CLI names Podman itself in its own error message. Operator decision.
3. `TODO(verify):` **`tests/e2e/seam.setup.ts` and MD-021.** The file exists; `testing-standards.md:38-41`
   describes the defect as open. Re-run and correct that table — it is human-owned and stale either
   way.
4. **The permission-model test still does not exist.** Owed under every option, named in
   `testing-standards.md:104-109` and in `rbac-and-security.md:143-148` as the only thing that
   catches a fail-open policy. It should not be attributed to whichever migration finally surfaces it.

---

## Outcome — 2026-09-04, the same day

**The operator chose option 3 (SQLite), then reversed it within the hour.** Their words on reversing:
*"bỏ quyết định dùng SQLite, quay lại supabase"*.

`ADR-027` was written to record the first decision and is now `WITHDRAWN`. **It never entered a
commit and nothing in it was applied** — phase 0 never ran, and the nine ADRs it proposed to supersede
were never edited. `ADR-005` and `ADR-026` are in force, unbroken.

**So the standing recommendation of this document is the live one again: option 0, self-host the
Supabase stack, ≈4 days.** It answers both motives the operator gave — cost / vendor lock-in and
running local / offline — supersedes no ADR, rewrites no standard, and changes no line of source. Its
one prerequisite is a container runtime, and none is installed on this machine.

**Two things this exercise surfaced that are owed regardless of datastore, and neither is discharged
by the reversal:**

1. **The live `SUPABASE_SERVICE_ROLE_KEY` committed at `5a29434` on `origin/ops/architecture` has not
   been rotated** (`.gitignore:17-20`, `.ai/standards/rbac-and-security.md:152`). Under ADR-005 that
   key bypasses row-level security, which is the whole authorization model. It is now the most urgent
   item in the repository.
2. **The permission-model test does not exist**, though
   `.ai/standards/rbac-and-security.md:143-148` and `.ai/standards/testing-standards.md:104-109` both
   require it and call it the only thing that catches a fail-open policy. `tests/` holds
   `seam-parity.test.ts`, `ui-language.test.ts` and `e2e/` only.
