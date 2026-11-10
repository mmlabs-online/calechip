---
doc_version: 3
last_updated: 2026-09-04
governed_by: [RULE-01, RULE-02, RULE-04, RULE-09]
---

# ADR-027 — The datastore becomes SQLite behind a server this team writes, and the authorization model moves out of the database into TypeScript

## Status

`WITHDRAWN by the operator` — 2026-09-04, within the hour, before this file entered any commit.

> ## THIS DECISION IS NOT IN FORCE AND NEVER WAS
>
> **Do not act on any part of this document.** The operator reversed it the same day, in the words
> *"bỏ quyết định dùng SQLite, quay lại supabase"* — drop the SQLite decision, go back to Supabase.
>
> **Nothing in it was ever applied.** It was never committed; phase 0 never ran; the nine ADRs named
> below were never edited and all nine still read `ACCEPTED` on disk. **ADR-005 is in force.**
> Authorization is row-level security and there is no server. **ADR-026 is in force** and
> `supabase/db.sql` is the target schema, merged in [#43].
>
> It is kept, rather than deleted, for the same reason ADR-025 is kept: a log that is silently
> corrected is one that can only ever agree with the present. It is the record that this was
> considered, costed and declined — and §1 is still the most complete inventory anywhere of what the
> PostgreSQL dependency actually consists of. Read it as an inventory. Do not read it as a decision.

The line it replaces, preserved because a status that was written and then reversed is more
informative than one only ever asserted once: *`ACCEPTED by the operator` — 2026-09-04, in answer to
the estimate question recorded in Context.*

**Supersedes nothing.** It *proposed* superseding ADR-005, ADR-009, ADR-011, ADR-014, ADR-016, ADR-018, ADR-020, ADR-024 and ADR-026, and none of that happened.
Five of those carry `ACCEPTED by the operator` — ADR-005, ADR-009, ADR-014, ADR-020 and ADR-026 —
and under ADR-008 no agent could have taken this decision. It was put to the operator with its price
attached and they took it. Each supersession is itemised in *§1 What dies, and exactly what dies of
it*, because "supersedes ADR-005" without the clause list is a claim, not a record.

**Nothing below re-argues the decision.** `.ai/steward/context.md:59` says *disagree once, then
comply fully*; the disagreement was
`.ai/board/estimates/2026-09-04-supabase-to-sqlite.md` §10, which ranked this option last on its own
merits and recommended `supabase start` instead. That document stands in the repository unedited as
the record of what this costs and is cited here rather than repeated. This document is the
compliance half, and it is written to be as useful as the decision permits.

## Context

The operator asked *"what if I change from supabase to using SQLite"*, gave the motive as **cost /
vendor lock-in** together with **wanting it to run local / offline**, and was then given a costed
estimate of four options. The question was put back to them as a three-way choice with the numbers on
each. The two cheaper options were the developer machine (≈4 days, nothing in `.ai/` changes) and the
self-hosted shared stack (8–12 days plus a permanent operations cost).

They chose the third. **The option text they chose, reproduced verbatim, because it is the
provenance of this ADR and the only evidence that the price was in front of them:**

> **Vẫn muốn SQLite dù đã biết giá**
>
> Phương án 3, 15–30 ngày. Chọn cái này nếu anh muốn một file duy nhất, không container, không dịch
> vụ nền — và chấp nhận đổi lại bằng một server tự viết chứa toàn bộ phân quyền. Cần chính anh ký
> ADR supersede ADR-005 và bốn ADR khác mang chữ ký của anh (RULE-01) — em không ký thay được.

So the following were accepted explicitly, not inferred: **15–30 engineering days**; **a
self-written server holding the whole authorization model**; and **ADR-005 plus four other
operator-signed ADRs come down**.

The measurements this decision rests on are in
`.ai/board/estimates/2026-09-04-supabase-to-sqlite.md` and are not restated. Four of them are
load-bearing here and are repeated with their counts because every section below depends on them:

- **SQLite has no row-level security, no `GRANT`, no roles and no session identity.** There is
  nothing for `supabase/db.sql`'s **16 `create policy` statements**, **13 `grant` statements** and
  **5 `revoke` statements** to become. `sqlite3_set_authorizer` is a C callback at
  statement-compilation time; it decides at table and column granularity, cannot see a row, and
  cannot be written in SQL.
- **28 executable `auth.uid()` references disappear with no equivalent** (34 occurrences in
  `supabase/db.sql`, 6 of them inside comments). A SQLite connection is a file handle, not a
  principal.
- **A browser cannot open a shared file.** SQLite in the browser (wasm + OPFS) gives every person
  their own database and therefore no shared board, which `CLAUDE.md` says the product *is*. That
  shape is refused below. The only remaining shape is SQLite behind a process this team writes.
- **The counts given to this ADR in its brief were wrong in two places and are corrected here rather
  than carried.** The brief said 30 grants and 8 revokes; `grep -cE '^\s*grant '` and
  `'^\s*revoke '` on `supabase/db.sql` return **13** and **5**. The word appears 45 and 11 times
  respectively, the remainder inside comments. `28 executable auth.uid()` is correct. The brief also
  said *nine shipped features*; `.ai/registry/features.md` carries **eight** rows at `DONE` and the
  ninth item is a shipped **ticket**, OPS-001 (`.ai/board/backlog.md:206`). §5 uses the measured
  figures.

## Decision

**1. The datastore is SQLite, in one file, owned by one server process this team writes.**

The browser-embedded shape (wasm + OPFS) is refused, on the charter rather than on engineering
taste: `CLAUDE.md` defines CaleChip as *"a planning board on which every member of one team declares
… so the team can see a crowded day"*, and a per-device database is not a slower version of that, it
is a different product. If that shape is ever wanted, it ends the shared board and amends
`.ai/00-charter.md` first.

**2. Authorization moves out of the database and into TypeScript on that server, and the server is
the only enforcement point.**

This reverses `.ai/standards/architecture.md` `:82-83` — *"In row-level security, and nowhere else"* —
and `.ai/standards/rbac-and-security.md:87` — *"In row-level security policies, and nowhere else"*.
Both sentences become false on the day phase 5 lands and are rewritten under §4.

The reasoning that put them there is not defeated; it is **relocated**.
`.ai/standards/architecture.md` `:91-95` says a check that runs in the browser is an affordance because
the caller can issue the same request from anywhere else. That is still true. What changes is which
process is the one the attacker must go through: today it is PostgreSQL, tomorrow it is this server,
and the server qualifies **only** while it is the sole holder of the file and the actor id is derived
from a token the server itself verifies rather than from anything the caller supplies. Any operation
that takes an actor id as a parameter from the wire has silently returned the system to an affordance.

**3. RULE-02 survives unchanged and gains a second seam.** `src/lib/data/` stays the one door out of
the interface. Its job is still typing, shaping and a single import site — never enforcement — and
the checks inside it stay affordances and keep their comments. `src/lib/data/index.ts` `:91-375`
declares **19 operations**; that contract is the contract, and the HTTP layer serves it rather than
redesigning it.

**4. Integrity invariants stay in the database, and INV-01 stays a database constraint.**

This is the one place SQLite is better than the thing it replaces, and it was measured rather than
argued — see §1 under ADR-011 below. INV-01 becomes two `GENERATED ALWAYS AS … STORED` integer
columns plus a `BEFORE INSERT` trigger raising `RAISE(ABORT, 'overlapping_entry')`, INV-03 stays a
`CHECK`, INV-02 stays a `BEFORE UPDATE` trigger, and INV-06 stays a column shape. The invariants do
**not** move into the server, and a plan that moves them there is reversing this clause.

**5. Every clause of the superseded ADRs that is a *permission* or an *invariant* survives; every
clause that is a *PostgreSQL mechanism* dies.** §1 does that split ADR by ADR. Nothing in
`.ai/registry/invariants.md` changes text, and this ADR does not edit it — RULE-01.

**6. This ADR records a requirement and performs none of it.** Every file named in §4 is
`.ai/standards/**`, human plane under RULE-01 and CODEOWNERS. Every object named in §2 is code that
does not exist. No SQLite schema, no seam code, no standards edit and no ticket is written by this
document.

---

## §1 What dies, and exactly what dies of it

`(op)` marks `ACCEPTED by the operator` — the five that only the operator could bring down.

### ADR-005 — *Authorization lives in row-level security, and there is no server* `(op)`

**Superseded in whole.** Both halves of its title are reversed. Its Decision sentence
*"Row-level security provides authorization, and is the only mechanism that enforces it… No
server-side API is written"* and its Context sentence *"there is no server component and none is
planned"* are both false after phase 5.

Note what does **not** happen: ADR-005's own revert condition
(`ADR-005-authorization-in-rls.md:89-94`) is *"the first permission requirement that cannot be
expressed as an RLS policy without duplicating the rule in application code"*, and **that condition
never fired**. A datastore with no policies does not meet it; it moots it. This supersession is
therefore outside anything ADR-005 anticipated, which is precisely why it required the operator's
signature and not an agent's judgement.

What survives ADR-005 intact, and must be carried forward by name: its sentence that *domain
invariants are enforced in the database* (Decision, para 3), and its warning that
*"a policy is easy to write and easy to get subtly wrong, and a permissive one fails open and
silently"* (Consequences). The second one is the whole of §3 below, with the word *policy* replaced
by *function*.

### ADR-009 — *A person joins by signing up against an allow-list* `(op)`

**Superseded on mechanism; the decision survives in substance.**

Dies: `supabase.auth.signUp` on the ordinary client (`src/lib/data/supabase.ts:316`); the trigger
`admit_allow_listed_member`, which is `after insert or update of email_confirmed_at on auth.users`
(`supabase/db.sql` `:580-582`); and the `email_confirmed_at` transition it fires on, which is GoTrue
state and not application state.

Survives: **an admin adds an address to an allow-list, the person signs themselves up, and a member
row is created only if the address is on the list and is then consumed.** That is a product decision
about how people join a team and nothing about it is PostgreSQL. It is re-enacted as server code
inside one transaction. The allow-list table survives with `email extensions.citext primary key`
(`supabase/db.sql:156`) becoming `email text primary key collate nocase`.

Also survives, and must be carried into the interface deliberately rather than rediscovered: ADR-009
Consequences — *"a person who signs up before being allow-listed gets an auth user with no member
row"*. Under a written auth service that state is still reachable and still must not look like a bug.

### ADR-011 — *INV-01 becomes an exclusion constraint over two generated range columns*
`ACCEPTED by tech-lead-design`

**Superseded on mechanism, and explicitly not defeated on substance. This is the correction this ADR
owes its own estimate, and it goes here rather than in a footnote.**

The framing this migration was originally examined under held that SQLite cannot hold INV-01. **That
is wrong, and it was refuted by running it, not by reasoning about it** —
`.ai/board/estimates/2026-09-04-supabase-to-sqlite.md` §2.1. `.ai/standards/data-model.md:159` calls
INV-01 *"the one a read-then-write check cannot hold"* and `.ai/standards/architecture.md:108` gives
the reason as *"two tabs, two devices, or a retry defeat it, and only the database sees both
writes."* **That is a statement about PostgreSQL's concurrency, not about invariants in general.**
SQLite permits one write transaction per file at a time, and a `BEFORE INSERT` trigger runs inside
the writing statement's own transaction, so there is no window between the scan and the insert. All
four rows of ADR-011 §3's correctness table were reproduced against a throwaway database on this
machine; the conflicting concurrent write returned `Error: database is locked (5)` and its row was
absent afterwards. **SQLITE_BUSY is loud** — it is never the silent lost update ADR-011 was
defending against.

Dies: `daterange`, `int4range`, `EXCLUDE USING gist`, `btree_gist`, and the column names `date_range`
and `portion_slots` in their range form. ADR-011 §2's entire rationale dies with them, because it
rests on PostgREST filtering on columns rather than expressions
(`entry?date_range=ov.[2026-01-01,2026-02-01)`) and there is no PostgREST.

Survives, and is now the definition RULE-04 binds: the **two-slot day** — `full → [0,2)`,
`am → [0,1)`, `pm → [1,2)` (`supabase/db.sql` `:194-199`) — re-expressed as two generated stored integer
columns whose names are `slot_lo` and `slot_hi`, with `&&` becoming `a.slot_lo < b.slot_hi and
b.slot_lo < a.slot_hi`. ADR-011's rejected alternative `portion WITH =` stays rejected for exactly
the reason it gives, and the new arithmetic must be tested against the same three-row table.

Two of ADR-011's recorded defects **close for free** and the closure must be noticed rather than
silently inherited: the `'[]'` constructor footgun and PostgreSQL's `[)` canonicalisation
(ADR-011 §1) both disappear with the range type, and `CHECK (end_date >= start_date)` — which
ADR-011 Consequences records as enforced by nothing today — is an ordinary check constraint.

One property is genuinely lost and is not compensated: **the exclusion constraint also *was* the
index serving the calendar's overlap read** (ADR-011 §2). Under SQLite that becomes an ordinary index
plus hand-written overlap arithmetic — the same semantics stated in a second place, which is what
ADR-011 §2 argued against.

Two caveats bound clause 4 of the Decision and must appear in `.ai/standards/data-model.md`: the
single-writer guarantee is a property of **one file on one machine's filesystem**. It does not
survive a replicated libSQL/Turso deployment, and SQLite's own documentation warns that advisory
locking is not dependable over NFS or SMB. Choosing either later reopens INV-01.

### ADR-014 — *A policy-only migration is not `schema_delta: none`* `(op)`

**Superseded on subject; its rule must be re-enacted immediately or a control is lost silently.**

Its Decision names *"a migration that creates, alters or drops a row-level security policy"*. After
phase 5 there are no policies, so read literally the rule becomes vacuous and **every authorization
change would pass Definition of Ready as `schema_delta: none` with nothing linked** — the exact
outcome ADR-014 was written to prevent, arriving by the back door.

The successor rule the operator is owed, stated here so it is not lost between documents: **a change
to the server's authorization code, or to a trigger or constraint that enforces an invariant, is not
`schema_delta: none` and needs an approved ADR linked at Definition of Ready.** ADR-014's rationale
transfers word for word — it removes the only stop between a permission change and a merged pull
request. Its Consequences sentence *"most TEA and ADM tickets now need an ADR"* stays true and stays
the accepted cost.

### ADR-016 — *Only an admin may change an entry's decision columns, and the guard is a trigger*
`ACCEPTED by tech-lead-design`

**Superseded in part, and the split is the whole migration in miniature.** Its function
`public.entry_enforce_decision()` (`supabase/db.sql` `:456-546`) has three labelled clauses:

| Clause | What it is | Fate |
|---|---|---|
| (a) the admin guard | refuses a move of `status`, `rejection_reason`, `approved_by`, `approved_at` by a non-admin; reads `v_uid := (select auth.uid())` (`supabase/db.sql:459`) and `public.is_admin(v_uid)` | **Dies.** It is authorization and its entire input is `auth.uid()`. Moves to the server |
| (b) provenance | writes `approved_by := v_uid` and `approved_at := now()`, *"never trusted from the wire, in either direction"* | **Dies as a trigger, and is the most dangerous single line in this migration.** `approved_by` is the only audit trail v1 has (`.ai/standards/rbac-and-security.md` `:155-158`). In SQLite the trigger cannot know who is asking, so the value must come from the server — and if it ever comes from the request body instead, the audit trail is forgeable by any caller, which is the precise thing this clause exists to prevent |
| (c) INV-02 | resets `status`, `approved_by`, `approved_at`, `rejection_reason` when `start_date`, `end_date`, `type`, `portion` or `tentative` change; **actor-blind on purpose** | **Survives.** A `BEFORE UPDATE … FOR EACH ROW` trigger comparing `OLD` and `NEW` is a direct port |

The same split applies to `public.member_enforce_role_and_removal()` (`supabase/db.sql` `:380-427`):
four clauses are actor-blind and port directly — no demotion (`:390`), no promoting a removed member
(`:396`), removal is one-way (`:402`), `removed_at := now()` written by the database (`:422`). **One
does not port**: *"an admin may not remove themselves"* (`:414-417`), whose test is `old.id = v_uid`.
It moves to the server.

ADR-016's Context is the strongest argument in the repository *for* keeping authorization below the
application, and it must be read before writing the server's entry module: an RLS `with check` sees
only the NEW row, so *"`status` did not change"* was not expressible, and CAL-02's own-entry policy
would have admitted `PATCH {"status":"approved"}` against the member's own row. That hazard does not
disappear under SQLite — it becomes an ordinary comparison in TypeScript that nothing forces anybody
to write.

### ADR-018 — *Who may read the member list, and the policy that carries it* `ACCEPTED by steward`

**Superseded on mechanism; the permission survives untouched.** The permission is the operator's,
confirmed 2026-08-31, and this ADR does not reach it: **a signed-in member may read every `member`
row belonging to their own team; an admin reads exactly the same rows and the same fields, and no
more.** ADR-018's sentence about why the admin read is not written separately survives verbatim.

Dies: the policies `member_select_own` and `member_select_team`, and the `security definer` helper
`public.member_team_id(uid)`. The helper's behaviour — it filters `removed_at is null`, so a removed
caller resolves to `null` — survives as server code and must be re-tested, because it is the kind of
detail that is reimplemented as `WHERE team_id = ?` and quietly stops refusing removed members.

ADR-018 Decision point 2 survives and is easy to lose: **the read does not filter `removed_at`.** A
removed member's row is returned to their teammates carrying `removed_at`, because INV-04 cannot
derive membership-as-of-a-date otherwise. Which rows the *screen* draws is a display decision above
the seam.

### ADR-020 — *The admin write path on `member`, and ADR-018 point 3 narrowed* `(op)`

**Superseded on mechanism; both halves of the permission survive.** ADR-020's three conditions were
*column-level grant*, *policy scoped to an admin of the caller's own team*, and *a `BEFORE UPDATE`
trigger enforcing what `WITH CHECK` structurally cannot*. Column grants and policies do not exist in
SQLite; the third condition survives as a trigger and the first two become server code.

Survives, permanently, and this ADR restates it because it is the clause a later ticket will be
tempted to widen: **no create or delete operation on `member` is exposed, now or by any later
ticket.** TEA-01's reason is dialect-independent — the admission path is the only creator of a
`member` row, and any create path a signed-in person can reach lets them choose their own `team_id`
and their own `role`.

### ADR-024 — *`supabase/seed.sql` is human-applied and converge-only* `ACCEPTED by tech-lead-design`

**Superseded, and one of its clauses inverts rather than dying.**

Dies: the apply commands `supabase db push --db-url` and
`supabase db query --file supabase/seed.sql --db-url` (Decision point 2), and every argument that
rests on GoTrue — Decision point 4's `auth.users` unique index on `email`, and the
`admit_allow_listed_member` / `consumed_at` interaction it turns on.

Survives, reworded: **the seed is converge-only, and a ticket that changes an existing seeded value
must name the corrective statement a human runs** (Decision point 1). That is a contract about a
file, not about a vendor. RULE-09 keeps applying it human.

**Decision point 3 inverts and this is the one good piece of news in the supersession list.** It
forbade any check that compares the seed file to the project, because such a check needs a credential
no place in this repository may hold — the service-role key, which
`.ai/standards/rbac-and-security.md:128` says must never be committed. **Under SQLite the database is
a file on the machine running the test.** No credential is needed, so the comparison check ADR-024
names under *Alternatives rejected* as *"the right mechanism, and the one that would actually have
caught this"* becomes buildable for the first time. ADR-024's own revert condition anticipated
exactly this — *"a credential with a place to live exists"* — by a route it did not foresee.

Not superseded and not this ADR's business: ADR-024 Decision point 5, the live
`SUPABASE_SERVICE_ROLE_KEY` committed at `5a29434` (`.gitignore:17-20`). **Retiring the Supabase
project does not discharge it.** Rotation is the only remedy
(`.ai/standards/rbac-and-security.md:152`), it is incident response, and it does not wait on any
phase below.

### ADR-026 — *`supabase/db.sql` carries the target schema* `(op)`

**Superseded on artefact; its policy survives and should be re-enacted deliberately.**

`supabase/db.sql` is 1,003 lines of PostgreSQL and is not portable — 16 policies, 13 grants, 5
revokes, 5 enums, `btree_gist`, `citext`, `daterange`, `int4range`, `exclude using gist` and 4
`language plpgsql` bodies. The artefact is replaced by a SQLite equivalent. So is ADR-026 Decision
point 5's idempotence-and-one-transaction property, which is worth keeping and is cheap in SQLite.

Survives, and is the operator's own preference expressed one day earlier: **the consolidated file
carries the target schema rather than only the shipped schema, every forward-dated object carries a
comment naming the ADR clause it came from and the ticket that still owes its migration, and every
undecided thing is declared absent in the file rather than discovered from behaviour** (points 1, 3
and 4). Point 6 survives with its noun changed: the migration directory is still the mechanism, and
the consolidated file is not a migration.

ADR-025 is already `SUPERSEDED by ADR-026` and is not touched.

### The four that survive, and one that is not affected

An ADR that survives unchanged is as useful to record as one that dies.

| ADR | Verdict |
|---|---|
| **ADR-015** — *The holiday calendar is national, and a row carries the kind of day it forces* (`ACCEPTED by tech-lead-design`) | **Survives.** Both decisions are domain decisions and neither is PostgreSQL. §1 (no `team_id`; the calendar is system-wide) is untouched. §2's two-value enum `('non_working','working')` keeps its values under RULE-04 and changes only its expression, to `CHECK (kind IN ('non_working','working'))`. `unique (date)` survives and stays load-bearing. §3's `enable row level security`, `revoke`, `grant` and the four `holiday_*` policies die with everything else in that class; the permissions they carried — read for every signed-in member, write for an admin — survive verbatim and move to the server. **ADR-015's refused alternative gets stronger, not weaker**: it refused holding the weekend rule and bridge-day derivation in SQL, so that the in-memory mock could share one definition. That reason survives a change of database intact |
| **ADR-024 point 5** and the committed service-role key | **Unaffected, and still owed.** See above |
| **ADR-006** — one working directory | **Unaffected.** ADR-023 — one pull request per ship — **unaffected.** ADR-022 — the QA stage is removed — **unaffected.** None of the three touches the datastore |
| **ADR-013** — removed members count until removal | **Survives.** It is a rule about INV-04's denominator, held by a soft delete, and `removed_at` is a column in either dialect |

---

## §2 What must now exist that does not exist at all

**There is no prior art for any of this in `src/`.** `find src -type f` returns **20 files** and
every one of them is client-side. `supabase/migrations/` holds 7 SQL files. Nothing in this
repository is a server, an HTTP handler, or a line of authentication code. That is the honest
starting position and it is why the estimate's range is 15–30 rather than something narrower.

1. **A server process** owning the SQLite file. New runtime dependency (`better-sqlite3` or libSQL),
   so review check R9 requires an ADR — `.ai/standards/tech-stack.md` `:195-197`. It also needs a
   deployment target, where `.ai/standards/tech-stack.md` `:155-159` currently carries an open
   `TODO(project)` for a **static** build.

2. **An HTTP layer serving 19 operations** (`src/lib/data/index.ts` `:91-375`). Every one is a PostgREST
   call today whose failure semantics the seam already depends on in detail: `23P01` →
   `overlapping_entry` (`src/lib/data/supabase.ts:261`), `42501` and `PGRST301` → `not_permitted`
   (`src/lib/data/supabase.ts` `:234-235,278-279`), and the *"zero rows is a refusal, not success"* rule
   that `src/lib/data/index.ts` `:190-194,314-316,333-337` states three separate times. All of it is
   re-specified against a new wire format. The `Result`/`FailureCode` vocabulary survives.

3. **An authentication service.** Password hashing, session or JWT issuance, refresh, sign-out, and
   **email confirmation** — not optional: TEA-01 AC-7 requires *Confirm email on*, which
   `src/lib/data/mock.ts:390` records verbatim (*"AC-7 requires Confirm email on, and under that
   setting signUp returns no session"*) and `src/lib/data/supabase.ts` `:316-330` branches on. This is
   the single largest ongoing correctness liability in the decision: it is the class of code where a
   subtle error is a breach rather than a bug.

4. **A replacement for the identity `member.id = auth.users.id`, which `data-model.md` makes
   structural.** `supabase/db.sql:143` reads
   `id uuid primary key references auth.users (id) on delete restrict`. That is not a convenience —
   it is the reason a `member` row cannot exist before its account, and it is what ADR-009 was
   written around. A `user` table inside the same SQLite file, with `member.id` referencing it,
   restores the property; anything that stores an id from another system without a foreign key does
   not, and the difference will not be visible until a row is orphaned.

5. **The seven Auth call sites in the seam**, all on the ordinary client:
   `auth.getUser` (`src/lib/data/supabase.ts:174` and `:692`), `auth.signUp` (`:316`),
   `auth.getSession` (`:573`), `auth.onAuthStateChange` (`:590`), `auth.signInWithPassword` (`:607`),
   `auth.signOut` (`:620`). These are the **cheap** part. `onAuthStateChange` and `getSession` are
   client-library behaviour over `localStorage` and have no equivalent until something is written to
   be their equivalent.

6. **A sharing story for one file.** One machine, one file, one writer. That is exactly what makes §1
   ADR-011's INV-01 proof work, and it is simultaneously the ceiling on how the shared board is
   served. The two cannot be separated.

**The best asset in the repository for this work is `src/lib/data/mock.ts`** — 983 lines, a complete
working non-Supabase implementation of all 19 operations, including hand-reproduced policy predicates
(`:281-347`), INV-01 at `:304` and `:722`, `member_team_id` at `:311` and the admin test at `:339`,
bound to the real implementation by `tests/seam-parity.test.ts`. **The shape of a second backend is
proven and the contract is fixed.** What it does not prove is the thing that matters: its checks run
in one process with no adversary, exactly as `.ai/standards/architecture.md` `:93-95` says every
seam-level check is. Porting it gives working code; it becomes a control only when the server is the
sole holder of the file and the caller cannot supply its own actor id.

---

## §3 The authorization surface that moves into code, and the risk that comes with it

Counted on disk, not recalled:

| Surface | Count | Where |
|---|---|---|
| `create policy` | **16** | `supabase/db.sql` `:711-916` |
| `grant` statements | **13** | `supabase/db.sql` |
| `revoke` statements | **5** | `supabase/db.sql` `:613,617,621,636,697` |
| Executable `auth.uid()` references | **28** | 34 occurrences, 6 in comments |
| Trigger clauses that are authorization, not integrity | **4** | ADR-016 (a) and (b); `member` self-removal `supabase/db.sql` `:414-417`; `admit_allow_listed_member` in whole |

**Under the new arrangement all of it becomes reviewable TypeScript.** That is a genuine gain and it
should be stated as one: review checks R6 and R8 stop reading SQL migrations and read modules; a
reviewer can cite `file:line` in a language the whole team reads; the truth table can be asserted by
an ordinary unit test in-process, with no PostgreSQL and no token per role — which
`ADR-005-authorization-in-rls.md:78-80` recorded as a real cost of the arrangement being replaced.

**And nothing currently tests any of it.** `.ai/standards/testing-standards.md` `:104-109` names a
permission-model test as one of two mandatory unit tests — *"Every role, every action, both
directions — including the denials. A permission test that only asserts the allow cases is a test
that passes when the check is deleted"* — and leaves `TODO(project)` for its path.
`.ai/standards/rbac-and-security.md` `:143-148`, known weakness 1, says in terms that a policy written
too permissively *"fails open and silently — no error, no log"* and that *"the only thing that
catches it is the permission-model test asserting the denials."* **That test does not exist.**
`tests/` holds `seam-parity.test.ts`, `ui-language.test.ts` and `e2e/`, and neither unit file is it.

**Under SQLite that gap stops being a debt and becomes the single highest risk in the project.**
Today a wrong check in `src/lib/data/supabase.ts` is caught by PostgreSQL refusing the request
underneath it — the seam is an affordance and the database is the control, which is the entire point
of ADR-005. After phase 5 **there is no database refusing anything underneath a wrong check.** A
missing `if` in a TypeScript handler is not a degraded experience; it is the whole of the control,
absent, silently, with the request returning `200`.

`.ai/standards/rbac-and-security.md` `:137-193` carries seven known weaknesses. **Every one of them is a
statement about RLS or about a public anon key**, so all seven must be re-derived rather than edited.
Two change character rather than disappearing, and are named here so the rewrite does not lose them:
weakness 1 (fails open and silently) gets **worse**, for the reason above; weakness 6 (a `WITH CHECK`
policy cannot say *"this column did not change"*) **disappears as a mechanism limitation and returns
as a discipline problem** — the server can trivially compare old and new, and nothing forces it to.

---

## §4 Every file under `.ai/standards/` that must be rewritten

All human plane under RULE-01 and `.github/CODEOWNERS`. **This ADR records the requirement; it
performs none of it**, per `.ai/standards/tech-stack.md` `:205-207`, which says an agent needing a
change here stops with `gate: BLOCKED`.

| File | What changes |
|---|---|
| `.ai/standards/architecture.md` | § *Where authorization lives* (`:81-99`) deleted and rewritten — *"In row-level security, and nowhere else"* becomes *"on the server, and nowhere else"*, keeping the affordance paragraph verbatim because its reasoning survives. § *Layers* (`:59-76`) redrawn: the diagram's last line, `Supabase — PostgREST, Auth, PostgreSQL`, becomes a server and a SQLite file, and the seam's `may import: @supabase/supabase-js` becomes an HTTP client. § *Where invariants live* (`:101-118`) re-tabled. § *Boundaries the audit enforces* (`:120-129`) replaced, together with the `supabase-client-in-seam` entry in `.ai/registry/boundaries.json` and **check D12 with it** |
| `.ai/standards/rbac-and-security.md` | § *Where the check runs* (`:86-101`) rewritten, including its `TODO(project)` about naming the `is_admin(uid)` SQL helper, which now names a TypeScript function. § *Known weaknesses* (`:137-193`) — **all seven re-derived**, per §3. § Authentication and § Secrets rewritten: the anon key, the service-role key and the `.env` exposure at `:128` and `:152` all describe a system that will not exist, and the *new* secret is the server's token-signing key |
| `.ai/standards/data-model.md` | § *Where invariants are held* (`:151-170`) rewritten row by row — INV-01's row loses the exclusion constraint and gains generated integer columns plus the `BEFORE INSERT` trigger; the *Only an admin may decide an entry* row moves out of the table entirely, because it stops being held by the database at all. Every column type restated (`uuid`, `citext`, `daterange`, `int4range`, `timestamptz`, five enums). § *Migrations* (`:172-185`) renamed off the Supabase CLI. Its `TODO(project)` about adding the migrations directory to CODEOWNERS survives with a new path |
| `.ai/standards/tech-stack.md` | § *Datastore* (`:78-100`) — the table rows, and the whole paragraph at `:91-100` explaining ADR-005. § *Interface between the parts* (`:102-106`) — its `TODO(project)` asks *"whether any server-side code exists beyond what Supabase provides"*; the answer becomes yes and is the largest change on the page. § *Build and deployment* (`:155-159`) — a static SPA target becomes a static target **plus** a server. The *past reliable recall* table gains the SQLite driver and loses the Supabase CLI entries |
| `.ai/standards/testing-standards.md` | The permission-model test at `:104-109` gets its real path and stops being an integration test needing a live PostgreSQL and a token per role. The command table (`:14-22`) may gain a server test command. MD-021 at `:38-41` — the e2e suite *"does not pin which seam it drives"* — is restated against the new seam |
| `.ai/standards/integrations.md` | Supabase is the integration it describes |
| `.ai/standards/coding-standards.md` | Gains whatever the server's error, logging and transaction conventions are — today the file has no server to speak about |
| `.ai/00-charter.md` | **Only if** the browser-embedded shape is ever adopted, which Decision point 1 refuses. Named so that a later reader knows the charter is what stands in the way |

Also owed, outside `.ai/standards/`: `.ai/registry/boundaries.json` (the `supabase-client-in-seam`
boundary), `.github/CODEOWNERS` (the migrations path), and — **already owed and independent of this
decision** — the stale sentences at `.ai/standards/tech-stack.md:84` and `:189-191`, which say the
Supabase CLI is not installed when `package.json` carries `"supabase": "^2.116.0"` and the binary
reports `2.116.0`. ADR-024 recorded that correction as owed to a human; it is still owed, and it will
be deleted rather than corrected if the rewrite reaches that page first.

---

## §5 The shipped work, and what re-verification means for each

**Eight feature rows are at `DONE`**, not nine (`.ai/registry/features.md` `:88,89,90,117,118,119,120,121`).
Nine shipped *tickets* if OPS-001 is counted (`.ai/board/backlog.md:206`). The re-verification budget
is 2–3 days and it sits **inside** the 15–30, not beside it.

| Feature | Behaviour | Enforcement mechanism |
|---|---|---|
| **CAL-01** — Create an entry over a range | **Identical.** Same fields, same refusal on overlap, same message | **Replaced.** INV-01 moves from `exclude using gist` over `daterange`/`int4range` to generated integer columns plus a `BEFORE INSERT` trigger; the seam's `23P01` → `overlapping_entry` mapping (`src/lib/data/supabase.ts:261`) is re-derived from a `RAISE(ABORT)` message. INV-03's check and INV-06's column shape port unchanged |
| **CAL-02** — Edit or delete their own entry | **Identical** | **Replaced, and this is the highest-risk row on the page.** The own-entry rule stops being policy `entry_update_own` and becomes an `if` on the server. ADR-016 § Context and `.ai/standards/rbac-and-security.md` `:172-186` both record that this exact permission, written the obvious way, accepts `PATCH {"status":"approved"}` against the member's own row. INV-02's trigger clause (c) ports unchanged |
| **CAL-03** — Edit or delete another member's entry, as an admin | **Identical** | **Replaced.** The admin predicate moves out of policy and out of `public.is_admin(uuid)`. INV-02 stays actor-blind, so an admin's edit still revokes approval exactly as the owner's does — a property held by the trigger, and therefore one of the few here that does not move |
| **TEA-01** — Sign up and establish the member record | **Identical to the member, and rebuilt underneath.** The confirmation email must still arrive: AC-7 requires *Confirm email on*, and `src/lib/data/mock.ts:390` and `src/lib/data/supabase.ts` `:316-330` both branch on `signUp` returning no session | **Replaced in whole.** GoTrue, `auth.users`, `email_confirmed_at` and the `admit_allow_listed_member` trigger are all gone. This is the single biggest re-verification on the list and the one most likely to consume the estimate's upper bound |
| **TEA-02** — Manage the allow-list | **Identical** | **Replaced.** `email extensions.citext primary key` (`supabase/db.sql:156`) becomes `text collate nocase` — same case-insensitive comparison, ASCII-only, which is irrelevant for an email local part. The admin-only write moves from policy to server |
| **TEA-03** — Team member list | **Identical, including the part that looks like a bug.** Removed members' rows are still returned, carrying `removed_at` — ADR-018 point 2 | **Replaced.** Two select policies and `public.member_team_id(uid)` become one server query, and the helper's `removed_at is null` filter must be re-tested rather than assumed |
| **TEA-04** — Remove a member, promote a member to admin | **Identical** | **Split.** Four of five clauses in `public.member_enforce_role_and_removal()` are actor-blind and port as a trigger (`supabase/db.sql` `:390,396,402,422`). *"An admin may not remove themselves"* (`:414-417`) moves to the server. ADR-020's column-level `grant` has no equivalent and becomes a whitelist of writable fields in one place |
| **TEA-05** — Sign in, sign out, member-less landing state | **Identical, and the landing state matters more than it looks.** ADR-009's *"signed up but not allow-listed"* state must survive the auth rewrite | **Replaced in whole.** `signInWithPassword`, `signOut`, `getSession` and `onAuthStateChange` are all client-library behaviour today; session persistence becomes something this team designs |
| **OPS-001** — UI copy to English | **Identical.** No datastore surface | **Unchanged.** Re-run only |

Beyond the features: **6 end-to-end spec files** (`tests/e2e/cal-01-create-entry.spec.ts`,
`cal-02-edit-delete-entry.spec.ts`, `cal-03-admin-edit-entry.spec.ts`, `tea-01-signup.spec.ts`,
`tea-05-sign-in.spec.ts`, `smoke.spec.ts`) plus `tests/e2e/seam.setup.ts`, 2 unit test files, and the
Definition-of-Done commands at `.ai/standards/testing-standards.md` `:14-22`.

---

## Rationale

The alternative, and it was the recommendation: **`supabase start` — the local development mode of
the thing already chosen.** `.ai/board/estimates/2026-09-04-supabase-to-sqlite.md` §4 costs it at
**≈4 days**, with **zero ADRs superseded, zero standards rewritten and zero source changes** — only
`VITE_SUPABASE_URL` moves, because `src/lib/data/supabase.ts` `:40-41,50-54` reads it from the
environment and constructs the client lazily. It serves both stated motives: every component is open
source with no hosted bill and no proprietary part, and after the first image pull it runs offline.
It was ranked first and this option was ranked last.

**It was rejected by the operator, knowingly, and the reason is in the option text they chose:** they
want *một file duy nhất, không container, không dịch vụ nền* — one file, no container, no background
service. That is a real requirement and `supabase start` does not satisfy it. It is ~13 containers
(`gotrue, realtime, storage-api, imgproxy, kong, mailpit, postgrest, postgres-meta, studio,
edge-runtime, logflare, vector, supavisor`), it requires a container runtime that is not installed on
this machine — `which docker podman colima orbstack` returns all four absent, and the CLI names the
prerequisite in its own error — and Docker Desktop carries a commercial licence above a company-size
threshold, which is itself adverse to a cost motive. **A single file with no daemon is a thing option
0 cannot become**, and preferring it is not a mistake about the numbers.

The second alternative, self-hosted PostgreSQL without GoTrue (8–15 days, estimate §6), keeps ADR-005,
PostgREST, all 16 policies, the exclusion constraint and the three triggers, and replaces only
authentication. It fails the same requirement — it is still a server process and a daemon — and its
expensive half is *write the auth service yourself*, which this option also pays.

**What this decision buys, stated without hedging:** one file, no daemon, no container, no vendor,
and a genuinely offline product. One verified technical win in INV-01 under single-writer locking,
and one class of silent off-by-one-day bug eliminated with the range types. An authorization model in
a language every reviewer reads, testable in-process, where the mandatory permission-model test
becomes an ordinary unit test instead of the heavyweight integration test ADR-005 said it had to be.

**What it costs is §2 and §3**, and §3 is the part that is not measured in days.

---

## Consequences

**What becomes true:**

- One file. No container runtime, no background service, no hosted project, no vendor, and the
  product runs with no network.
- INV-01, INV-02, INV-03 and INV-06 are still held by the database, and INV-01 is held against every
  writer of the file — verified, not assumed.
- The permission model is TypeScript: reviewable by anyone on the team, citable at `file:line`, and
  unit-testable in one process.
- ADR-024's comparison check becomes buildable, because the database is a file and needs no
  credential.
- `end_date >= start_date` is enforced for the first time, and PostgreSQL's `[)` canonicalisation
  footgun is gone.

**What becomes worse, and none of it is small:**

- **A wrong permission check is now the whole failure, not half of it.** Today a mistake in
  `src/lib/data/supabase.ts` is caught by a policy underneath. After phase 5 nothing is underneath.
  The permission-model test stops being a good practice and becomes the only control on the
  authorization model.
- **This team now maintains an authentication service.** Password hashing, session lifetime, refresh
  rotation, confirmation-token expiry, and every CVE class that comes with them. That is permanent
  work, not project work, and it is the class of code where a subtle error is a breach.
- **The overlap read loses its index-and-constraint identity.** ADR-011 §2's single GiST index served
  both; now an ordinary index plus hand-written arithmetic states the overlap semantics twice.
- **One writer, one file, one machine.** Concurrency is bounded by SQLite's single write transaction,
  and INV-01's proof depends on it. The bound is invisible for a team of five to thirty and is a
  ceiling nonetheless.
- **The single-writer guarantee does not survive replication or a network filesystem.** libSQL,
  Turso, NFS or SMB each reopen INV-01. Any of them is a new ADR, not a deployment detail.
- **Backups, restore and file corruption become someone's job**, having previously been a hosted
  provider's. So does whatever serves the file to the team.
- **Eight ADRs' worth of institutional reasoning is now historical.** A reader of `supabase/db.sql`
  and of `.ai/standards/**` will, for the length of the migration, be reading documents that describe
  a system that no longer exists — which is exactly the failure `.ai/registry/invariants.md` warns
  about when an invariant is claimed and not held.
- **`.ai/registry/decisions/` gains a version-control problem it did not have.** ADR-005's
  descendants were coherent because one decision governed them; nine supersessions in one document
  is a lot of surface for a later reader to reassemble, which is why §1 is itemised clause by clause
  rather than summarised.

---

## Revert condition

**Two signals, and they are deliberately different in kind.**

1. **The permission-model test cannot be made to assert the denials for every role and every
   operation by the end of phase 1.** Not *fails* — *cannot be written*. If the truth table cannot be
   expressed against the current system, it will not be expressible against the new one either, and
   phase 5 would then be moving the entire authorization model to a layer nothing can check. Stop at
   phase 1 and reconsider; nothing has been lost, because phases 0 and 1 change no behaviour.

2. **A permission defect reaches a running instance, found by a person rather than by a test.** One
   occurrence. Record it in `.ai/board/metrics.md`. Under the old arrangement this class was
   structurally hard — the database refused the request whatever the client believed. If it happens
   once after the cutover, the layer chosen for authorization is not holding it, and that is the same
   shape of signal as ADR-005's own revert condition, pointing the other way.

**What would have to be true to go back.** Before phase 5, the answer is *nothing*: the Supabase
project, `supabase/db.sql`, the 7 migrations and the 16 policies are all still there and still
authoritative, and reverting is deleting new code. Between phase 2 and phase 4 the cost is thrown-away
work and no more.

**The point after which it cannot.** Reverting stops being an option when **member and entry data has
been written to the SQLite file and not to PostgreSQL**, and that moment is inside phase 5. From then
on, going back means a reverse data migration that no document specifies, plus a password store that
cannot be moved: password hashes written by a hand-written service are not GoTrue's hashes, so every
member would have to reset their password, and the moment they do the hosted project is stale again.
**Deleting the hosted Supabase project makes it final**, and the estimate at
`.ai/board/estimates/2026-09-04-supabase-to-sqlite.md` should be re-read before that button is
pressed rather than after. Keeping the project alive and paid for one billing period past the cutover
is the cheapest insurance available, and this ADR recommends it.

---

## The plan — seven phases, not tickets

Phases, so a human can see the order and where the first irreversible step is. Each becomes one or
more tickets at `/triage`, and **more than 12 files splits at PLAN**, so several phases will be
several tickets.

**Phase 0 — the paperwork, before any code.** This ADR merged under CODEOWNERS. The nine
supersessions applied as status-line edits (nothing else in those documents is touched — ADR-026's
own treatment of ADR-025 is the precedent). The successor rule for ADR-014 written, because from the
moment ADR-014 is marked superseded the Definition-of-Ready gate on authorization changes is open.
The R9 dependency ADR for the SQLite driver. Every file in §4 rewritten by a human. **Reversible.
Nothing runs differently.**

**Phase 1 — the permission-model test, written against the system that still exists.**
`.ai/standards/testing-standards.md` `:104-109` and `.ai/standards/rbac-and-security.md` `:143-148` both
already require it. **It lands here, first, and not last, and the argument is the whole reason this
plan is phased rather than sequential:**

- Written now, it is a **specification of the permission model as it behaves today**, captured from
  the system where the behaviour is correct because PostgreSQL is enforcing it. Written last, it is a
  description of whatever the new server happens to do — a test written from the implementation it is
  meant to check, which asserts the bug as readily as the rule.
- It is the **acceptance criterion for phase 3**. Without it, "the server's authorization is correct"
  has no observable meaning and phase 3 cannot be said to be finished.
- It is owed under **every** option including staying, so it is not a cost of this migration and
  should not be attributed to it.
- Its cost is *lower* here than anywhere later: it is the last moment the two implementations can be
  compared. After the cutover there is nothing to compare against.
- And there is a real chance it cannot be finished — see revert condition 1. **That is worth
  discovering in week one rather than in week four.**

Reversible. It is a test file against the existing system.

**Phase 2 — the schema, in SQLite, beside the existing one.** The DDL: 5 enums to `CHECK … IN`,
`citext` to `COLLATE NOCASE`, ranges to plain columns, `slot_lo`/`slot_hi` generated stored, INV-01's
`BEFORE INSERT` trigger, INV-03's check, INV-02's `BEFORE UPDATE` trigger, the four actor-blind
`member` clauses, `CHECK (end_date >= start_date)`, and a `user` table for §2 item 4. Tested against
ADR-011 §3's correctness table and ADR-016's clause (c). Nothing consumes it yet. **Reversible — a
new file beside `supabase/db.sql`, which stays authoritative.**

**Phase 3 — the server and the 19 operations, with authorization, and no authentication yet.** The
HTTP layer, the failure-code mapping, and every check from §3 in TypeScript, ported from
`src/lib/data/mock.ts`'s predicates. The actor id is injected by a test harness, never read from the
wire. **Done when phase 1's test passes against this implementation with the same assertions and no
edits to the test.** Reversible. Nothing in `src/` is repointed.

**Phase 4 — the authentication service.** Password hashing, session issuance and refresh, sign-out,
and email confirmation with a real token, because TEA-01 AC-7 requires it. Then the actor id comes
from a verified token instead of the harness, and the server becomes a control rather than an
affordance. Reversible, and the largest single liability in the plan.

**Phase 5 — the cutover. This is the first irreversible step.** `src/lib/data/supabase.ts` is
replaced by an HTTP client of similar size, `tests/seam-parity.test.ts` re-binds it to
`src/lib/data/mock.ts`, the 6 e2e specs run against the new stack, and the 8 shipped features are
re-verified per §5. **Irreversibility begins at a specific moment inside this phase: the first write
of real member or entry data to the SQLite file that is not also written to PostgreSQL.** Everything
before that is code; everything after is data. Keep the hosted project alive and paid for one billing
period past this line.

**Phase 6 — decommission.** `supabase/db.sql`, `supabase/migrations/`, `supabase/seed.sql`,
`@supabase/supabase-js` and the `supabase` devDependency removed; `.ai/registry/boundaries.json`'s
`supabase-client-in-seam` entry replaced and check D12 re-pointed; the hosted project deleted.
**Independent of every phase above and not discharged by any of them: the live
`SUPABASE_SERVICE_ROLE_KEY` committed at `5a29434` (`.gitignore:17-20`) must be rotated
(`.ai/standards/rbac-and-security.md:152`). Deleting the project does not rotate the key that is
already in the git history.**

---

## Affected documents

| File | Change | Moves to | Plane |
|---|---|---|---|
| `.ai/registry/decisions/ADR-005-authorization-in-rls.md` | Status → `SUPERSEDED by ADR-027`. Body untouched | `doc_version: 3` | registry, human |
| `.ai/registry/decisions/ADR-009-how-a-person-becomes-a-member.md` | Status → `SUPERSEDED by ADR-027` | `doc_version: 3` | registry, human |
| `.ai/registry/decisions/ADR-011-inv-01-exclusion-constraint.md` | Status → `SUPERSEDED by ADR-027`, with the note that the supersession is on mechanism and §1 records the measured refutation of the claim that SQLite cannot hold INV-01 | `doc_version: 3` | registry, human |
| `.ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md` | Status → `SUPERSEDED by ADR-027`. **Do not mark it superseded before its successor rule exists** — §1 | `doc_version: 4` | registry, human |
| `.ai/registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md` | Status → `SUPERSEDED by ADR-027`; clause (c) survives | `doc_version: 3` | registry, human |
| `.ai/registry/decisions/ADR-018-who-may-read-the-member-list.md` | Status → `SUPERSEDED by ADR-027`; the permission survives | `doc_version: 4` | registry, human |
| `.ai/registry/decisions/ADR-020-the-admin-write-path-on-member.md` | Status → `SUPERSEDED by ADR-027`; both permissions survive | `doc_version: 3` | registry, human |
| `.ai/registry/decisions/ADR-024-the-seed-is-human-applied-and-converge-only.md` | Status → `SUPERSEDED by ADR-027`; point 1 survives, point 3 inverts, point 5 is untouched and still owed | `doc_version: 3` | registry, human |
| `.ai/registry/decisions/ADR-026-db-sql-carries-the-target-schema.md` | Status → `SUPERSEDED by ADR-027`; points 1, 3, 4 and 6 survive as policy | `doc_version: 3` | registry, human |
| `.ai/registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md` | **No change.** Recorded here as surviving, which is the point of checking | unchanged | registry |
| `.ai/registry/invariants.md` | **No change.** No invariant's text moves; only where three of them are held | unchanged | registry |
| `.ai/registry/rules.md` | Enforcement map: RULE-02's lint rule now names an HTTP client rather than `@supabase/supabase-js` | `TODO(project)` | registry, human |
| `.ai/registry/boundaries.json` | The `supabase-client-in-seam` boundary is replaced; check D12 follows it | — | registry, human |
| `.ai/standards/architecture.md` | §4 | `TODO(project)` | standards, human |
| `.ai/standards/rbac-and-security.md` | §4 — including all seven known weaknesses | `TODO(project)` | standards, human |
| `.ai/standards/data-model.md` | §4 | `TODO(project)` | standards, human |
| `.ai/standards/tech-stack.md` | §4, plus the stale CLI sentences at `:84` and `:189-191` that ADR-024 already recorded as owed | `TODO(project)` | standards, human |
| `.ai/standards/testing-standards.md` | §4 — the permission-model test's path and level | `TODO(project)` | standards, human |
| `.ai/standards/integrations.md`, `.ai/standards/coding-standards.md` | §4 | `TODO(project)` | standards, human |
| `.github/CODEOWNERS` | The migrations path, once the new one exists | — | human |
| `.ai/00-charter.md` | **No change** under this ADR. Named in §4 only because Decision point 1 refuses the shape that would require one | unchanged | registry |
| `supabase/**`, `src/**`, `tests/**` | Phases 2–6. **Nothing is edited by this ADR** | — | agent, later |

**None of these edits is made by this document.** Registry and standards planes are human under
RULE-01; the code is phase work that has not been planned.
