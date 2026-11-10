---
stage: TRIAGE
agent: product
produced_at: 2026-09-03
inputs_read:
  - CLAUDE.md
  - .claude/commands/triage.md
  - .ai/templates/idea.md
  - .ai/steward/context.md
  - .ai/registry/invariants.md
  - .ai/registry/rules.md
  - .ai/standards/tech-stack.md
  - .ai/standards/testing-standards.md
  - .ai/registry/decisions/ADR-021-the-qa-waiver-is-reverted.md
  - .ai/board/tickets/BUG-001/ticket.yaml
  - .ai/board/model-debt.md
  - supabase/seed.sql
  - src/lib/data/supabase.ts
  - src/routes/SignIn.tsx
  - tests/e2e/tea-05-sign-in.spec.ts
  - tests/e2e/cal-01-create-entry.spec.ts
  - tests/e2e/cal-02-edit-delete-entry.spec.ts
  - tests/e2e/cal-03-admin-edit-entry.spec.ts
  - scripts/check-docs.mjs
consulted: [tech-lead-design]   # RULE-11. Appended 2026-09-08 at the amendment in § 8, NOT on
                                # 2026-09-03. The technical half returned after the verdict below was
                                # written and reached REJECT independently; § 8 records what it found.
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

## Problem

**A person cannot sign in to the running application with the credentials this repository tells them
to use.** They type `thanh@example.com` / `password123` — the address written in four end-to-end
specs and in `supabase/seed.sql` — and the sign-in form answers *"Email hoặc mật khẩu không đúng."*
The password is not wrong. The account does not exist in the database the application is pointed at.

The reason a person reaches that screen at all is the second half of the problem, and it is the part
that costs time rather than a retry: **the repository actively tells them those credentials work.**
The address is in the seed file, it is in the fixture module, it is named in a comment at the top of
four spec files, and the end-to-end suite that uses it is green. Every signal a reader can check says
the account is there. Only the running product disagrees, and it disagrees in the one vocabulary that
means "you made a typo".

Underneath: `supabase/seed.sql` has grown with almost every ticket since TEA-01, and the hosted
project the application actually runs against was seeded once and never again. The file and the
database are two different rosters, nobody declared them to be, and nothing in the repository
compares them.

## Who has it

**Whoever runs the application against the real datastore, on the first sign-in they attempt with a
seeded account that is not `quan@example.com`.** Today that is the operator; on this repository that
is also every future developer, because `.env` carrying `VITE_SUPABASE_URL` is what makes
`src/lib/data/index.ts` resolve to the Supabase seam at all, so anyone who can run the product
against real data is in exactly this position.

It is not once. It recurs per account and per ticket: the person hits it again the next time they
reach for an address a newer ticket introduced. `thanh` and `hoa` (TEA-05) and `linh` (CAL-02) are
each a separate encounter, and CAL-03 — in flight right now — documents `thanh@example.com` in its
own spec header at `tests/e2e/cal-03-admin-edit-entry.spec.ts:29`.

## Evidence

**Three measurements, taken by the dispatching session on 2026-09-03 against the project named in
`.env` (`VITE_SUPABASE_URL`).** They are recorded here verbatim rather than re-derived. This agent
holds no `Bash` tool and could not re-execute them; everything else in this file was verified by
reading the files named in `inputs_read`.

1. `POST /auth/v1/token?grant_type=password` with the anon key, body
   `{"email":"thanh@example.com","password":"password123"}` →
   **HTTP 400**, body `{"code":400,"error_code":"invalid_credentials","msg":"Invalid login credentials"}`.
2. The identical call for `hoa@example.com` → **HTTP 400**, same body.
3. The identical call for `quan@example.com` / `password123` → **HTTP 200**, with an access token.

Measurement 3 is what makes this diagnosis rather than a guess: the project is reachable, the anon
key is correct, and the seed *was* applied — the first block of it. `quan` is the TEA-01 account.

**`git log -S<email> -- supabase/seed.sql` dates each seeded address to the ticket that added it**
(also taken by the dispatching session):

| Address | Added by | Commit |
|---|---|---|
| `quan`, `an`, `binh` | TEA-01 | `c9e5574` |
| `cu` | TEA-03 | `39344ad` |
| `dung` | TEA-04 | `1e350e3` |
| **`thanh`, `hoa`, `khanh`** | **TEA-05** | **`a8a4f9b`** |
| `linh` | CAL-02 | `3bb5474` |

The one account that signs in is the oldest one. The three that were measured failing, and the one
added most recently, are all after it.

**Verified by reading, in this run:**

- `supabase/seed.sql:341` inserts `thanh@example.com` with
  `extensions.crypt('password123', extensions.gen_salt('bf'))`. The file is not wrong; the file is
  simply not what the database contains.
- **There is no error-handling defect.** `src/lib/data/supabase.ts:207-208` maps `invalid_credentials`
  to a rendered message, and `src/routes/SignIn.tsx:95-97` renders it in `sign-in-error`. HTTP 400
  with `invalid_credentials` is how GoTrue reports bad credentials; the product handled it exactly as
  designed. What is wrong is upstream of every line of application code.
- **Four specs document the credentials that do not work:**
  `tests/e2e/tea-05-sign-in.spec.ts:10`, `tests/e2e/cal-01-create-entry.spec.ts:16`,
  `tests/e2e/cal-02-edit-delete-entry.spec.ts:22`, `tests/e2e/cal-03-admin-edit-entry.spec.ts:29`.
- **Nothing was ever going to notice.** BUG-001 pinned the end-to-end suite to the mock seam —
  `.ai/board/tickets/BUG-001/ticket.yaml` §5 records that a pinned build contains zero occurrences of
  `supabase.co` and is *structurally incapable* of reaching the live project. So the suite is green
  and says nothing whatever about the hosted database. The drift is invisible to every gate the
  project has and surfaces only when a human types credentials a test file told them to use.

## Impact if ignored

- **The gap widens by one ticket every ticket.** Each ticket that needs a fixture appends an account
  or a row to `supabase/seed.sql`, so the set of things written down but absent grows monotonically
  and never shrinks on its own.
- **It fails intermittently, and intermittently is worse than always.** Only the rows added after the
  last seeding are missing, so a person signs in as `quan` successfully, then as `thanh`
  unsuccessfully, in the same minute. That pattern reads as *"I mistyped the password"* or *"that
  account is broken"* — a per-account problem — rather than as *"the database is a version behind the
  repository"*. Every wrong first hypothesis is a session spent on the sign-in code, which is
  correct, and on the seed file, which is also correct.
- **It is not only accounts.** The unseeded portion of the file now includes `entry` rows: the
  approved entry `dd000000-…-0001` (CAL-02, `supabase/seed.sql:479`) and the other team's entry
  `dd000000-…-0002` (CAL-03, `:522`). CAL-02's own comments say the approved entry cannot be created
  through the product at all — no policy grants `status` — so against the live project the states
  those tickets exist to handle are unreachable by any means. Manual verification of shipped features
  silently checks a subset of what was built.
- **The drift runs in both directions.** ADR-021 and `.ai/board/tickets/BUG-001/ticket.yaml` record
  that unpinned acceptance runs created auth users in the live project, and BUG-001 §10 leaves
  *"inspecting what the acceptance runs already wrote to the live project"* explicitly out of scope
  and owed to a human. So the project may also hold rows that appear in no file. Left alone, neither
  side is a description of the other and there is no artifact that says so.
- **The confidence cost compounds.** The next person to hit this has to establish, from scratch, that
  the seed file, the fixture module, the error mapping and the sign-in form are all correct before
  they can conclude that the database is the thing that is behind. That work has now been done once;
  if it is not written down it will be done again.

## Constraints already known

Checked in this run, not assumed:

- **`.ai/registry/invariants.md` (doc_version 3) is not engaged.** All seven invariants range over
  `entry` and `member` rows and constrain the states data may be in. A database that is missing rows
  the seed file describes holds no wrong state — INV-01 to INV-07 each hold vacuously over the rows
  that are there. Stated as the mechanism rather than the conclusion, because that file warns at
  :62-66 that inferring "no invariant engaged" from safe behaviour is circular. **One adjacency
  worth naming for whoever plans this:** INV-04's denominator is the team's members with
  `removed_at is null`, so *adding* the missing `member` rows changes the absence count and the
  overload threshold for every date. That is a consequence of re-seeding, not of the drift.
- **ADR-005 — authorization lives in row-level security, and there is no server.** The browser holds
  the user's own token and talks to PostgREST directly. Two things follow. First, sign-in is
  GoTrue's, not this application's, so no code in `src/` can make a nonexistent account exist.
  Second, anything that reaches into the database to compare or repair rows is either a human running
  SQL with an elevated credential or a new mechanism that ADR-005 has not authorised — the solution
  space here is narrower than it looks.
- **BUG-001 and ADR-021 — the suite is pinned to the mock, and deliberately.** ADR-021 §"The six
  failures" traces why, and BUG-001 built it. **This is not a thing to undo.** The pin is what stops
  acceptance runs writing to the live project. Any answer here must leave the pin in place; a
  proposal that makes the suite touch the hosted database is proposing to revert BUG-001.
  `.ai/board/tickets/BUG-001/ticket.yaml` §10 already says a second suite against a real, dedicated
  test database is *"a separate decision"* with its own project, lifecycle and credentials.
- **`.ai/standards/tech-stack.md` § Datastore** — Supabase (PostgreSQL), migrations by Supabase CLI.
  Both rows still carry `TODO(project)`: the PostgreSQL major behind the hosted project is unrecorded
  and **the CLI is not installed**, and that file's *Still unverified* list names the CLI and its
  migration layout as things to read before writing an apply command. So "just run the seed" is not a
  command anybody in this repository has run and documented.
- **RULE-09 — schema changes and pull-request merges are permanently human**, and
  `supabase/seed.sql:1` opens *"Applied by a human (RULE-09), never by an agent."* Whatever is done
  here, the act of applying it is a person's.
- **`.ai/standards/testing-standards.md` § Fixtures** requires tests to share fixture data with the
  seed, *"a fixture that exists only in one test file drifts from the seed and produces failures that
  reproduce in CI and not locally."* The rule anticipated file-to-file drift. This is the same failure
  one layer down — file to **database** — and the standard has no rule for it.

**One thing a reader should not have to notice for themselves.** Every seeded account in
`supabase/seed.sql` uses the password `password123`, except `admin@calachip.com`, which uses `123456`
(`:121`). The project is a **real hosted Supabase instance**, not a local one, and its anon key is
public by design — `.ai/standards/rbac-and-security.md` already records that the endpoint is reachable
without this application. The seed file calls these *"development credentials"* that *"must not
survive contact with real data"* (`:103-104`), which is a stated intention and not a control.
**Whether that is acceptable for this project is the operator's judgement and is deliberately not
assumed here**, in either direction. It is surfaced because any answer to this idea involves deciding
what goes into that database, and that is the moment to decide it rather than after.

## Out of scope

- **Changing how the application handles a 400.** Stated plainly because it is the obvious framing
  and it is wrong: `src/lib/data/supabase.ts:207-208` and `src/routes/SignIn.tsx:95-97` are correct,
  the message is the right message, and a nonexistent account *should* be refused this way. A ticket
  that edits either file has misread this idea. In particular, making sign-in distinguish "no such
  account" from "wrong password" is a different question with a security argument attached, and it is
  not this one.
- **Reverting or weakening BUG-001's seam pin**, or pointing the end-to-end suite at the hosted
  project. See *Constraints*.
- **Standing up a second, dedicated test database.** Already named as its own decision in
  `.ai/board/tickets/BUG-001/ticket.yaml` §10 and in MD-021's fix shape. It may turn out to be the
  right answer to part of this, but it is not discharged here and must not be smuggled in.
- **Auditing or cleaning what past unpinned acceptance runs wrote into the live project.** Real,
  already owed to a human by BUG-001 §10, and a different piece of work.
- **Rotating or changing any credential**, including the two weak passwords named above. Surfacing
  them is not the same as deciding about them.
- **Changing the fixture module or the four spec headers.** They are accurate descriptions of
  `supabase/seed.sql`. The file they describe is not the thing that is wrong.

## Open questions

1. **Who owns applying the seed, and at what moment?** RULE-09 makes the act human. Nothing in the
   loop names *when* — no stage owns it, `/ship` does not, and no Definition of Done item mentions
   it. Until this is answered, a fix is a one-off repair rather than a mechanism, and the drift
   restarts with the next ticket.
2. **Is `supabase/seed.sql` meant to be re-runnable, and does the current file achieve it?** Every
   statement is `on conflict (id) do nothing` (`on conflict (email)` for `allowed_email`), so
   **re-running inserts what is missing and silently skips what is present** — which is exactly the
   repair this problem needs, and is safe against the existing rows. **But the same clause means it
   is not corrective:** a row already in the database keeps whatever values it has, so a changed
   password, `display_name`, `role` or `removed_at` in the file will never propagate. Is
   "converges on the missing rows, never on the changed ones" the intended contract, or is it an
   artefact of `do nothing` being the easy clause to write? An answer here decides whether re-seeding
   is a repair or a guarantee.
3. **What does re-seeding actually fire?** `admit_allow_listed_member` triggers on `auth.users`
   insert, and the seed's own comments (`:26-31`, `:170-175`, `:258-262`) reason carefully about it
   finding no allow-list entry and creating nothing. That reasoning was written for a fresh database.
   Has anyone confirmed it holds when the file is re-applied to a project that already contains
   `an@example.com`'s allow-list row, possibly consumed, and possibly auth users created by past
   unpinned runs?
4. **What is actually in the live project right now?** Nobody has listed it. The three measurements
   above establish that `quan` exists and `thanh` and `hoa` do not; the rest — `cu`, `dung`, `linh`,
   `khanh`, `chi`, `admin@calachip.com`, the second team, the two `entry` rows, the allow-list rows —
   is inferred from commit dates rather than observed. **A verdict does not strictly need this, but
   any fix does**, and it is cheap read-only work.
5. **Should the repository be able to detect this state at all?** Today the only detector is a human
   typing a password. Whether that is worth a mechanism — and, if so, whether the mechanism can exist
   at all without a credential that ADR-005 leaves nowhere to hold — is the question that decides
   whether this is one repair or a standing capability.
6. **Does anything else in the repository make the same class of claim?** The four spec headers and
   the fixture module describe the seed file, which was assumed to describe the database. If other
   documents assert facts about the live project's contents, they are wrong in the same way and by
   the same mechanism, and nobody has looked.

---

# Triage verdict — REJECT

**Written by `product` at `/triage` on 2026-09-08, five days after the problem above.** This file was
written on 2026-09-03 with `next_state: TRIAGE` and no verdict section; ~~it is being ruled on now.~~
Nothing in `## Problem` through `## Open questions` has been deleted or rewritten — where a fact
stated there has since become false, it is corrected in § 5 below rather than edited in place.

> ***CORRECTED 2026-09-08, LATER THE SAME DAY, AT THE AMENDMENT IN § 8. THE STRUCK CLAUSE IS WRONG
> AND IT IS THE FRAMING OF THIS WHOLE VERDICT.*** **This idea was ruled on, on 2026-09-03, and the
> ruling is ADR-024.** The idea file and that ADR landed in **one commit**, `8ce455e`
> (*"chore: ADR-024 — the seed is human-applied and converge-only"*, 2 files changed, 441
> insertions: +238 to this file, +203 to the ADR), and `ADR-024:21-27` quotes this file by name and
> reproduces its three measurements. **What is written below is therefore the write-back of a verdict
> already taken, not a first ruling** — and it happens to concur, independently and five days later.
> The defect this run actually repairs is bookkeeping, not judgement; § 8.1 states it. The
> front-matter's `consulted:` field is the one line above this heading that the amendment changed.

**No `Bash` tool in this session.** Every claim below was verified by reading a file. The three HTTP
measurements in `## Evidence` were **not** re-taken, and nothing here asserts what the hosted project
contains today.

## 1. The verdict, and the reason

**REJECT — already covered, and covered by a decision that redirected the problem rather than
repairing it.**

Half 1 is covered by
[ADR-024](../../registry/decisions/ADR-024-the-seed-is-human-applied-and-converge-only.md), which was
written from *this file* on the same day, plus the guard now standing at `supabase/seed.sql:37-49` and
`supabase/bootstrap.sql`, shipped as `OPS-004`. Half 2 is covered **only in part**, and the residue is
named in § 4 and deliberately not ticketed.

**The single sentence that decides it:** this file asks for the accumulated seed to be applied to the
hosted project, and **the repository has since decided that it must never be** —
`supabase/seed.sql:39` refuses to execute unless `calechip.seed_target` is set to `'local'`, and
`:22-23` records why: *"this seed has only ever been applied by hand, and it was applied by hand to
the hosted project. Every account below then existed there carrying a password published in this
file."* So `thanh@example.com` failing to sign in against the hosted project is no longer a drift to
be closed. It is the intended state, reached deliberately.

**REJECT was not the only live option and the other two were tested.** `NEEDS-ADR` fails because no
registry, schema or dependency decision remains: ADR-024 decision point 3 (`:97-110`) already forbids
the detector, and ADR-030 already decided how a real project gets its first admin. `PROMOTE` fails on
§ 4 — what is left is one comment in one shipped file, and the only substantive work behind it is the
second database that **this file's own `## Out of scope` forbids smuggling in** (`:195-197`).

## 2. Half 1 — *a person cannot sign in with the credentials the repository documents*

**Covered. It was answered, and then the answer was replaced by a better one.**

**First, ADR-024 answered it as asked.** Its `## Context` cites this file by name at `:22` and quotes
its three measurements. Decision point 2 (`:81-93`) named the repair, the owner and the exact command:

```
pnpm exec supabase db push  --db-url "$SUPABASE_DB_URL"
pnpm exec supabase db query --file supabase/seed.sql --db-url "$SUPABASE_DB_URL"
```

**Then the guard closed that route, and the closure is the load-bearing change.**
`supabase/seed.sql:37-49` is a `do $$` block whose test at `:39` is
`coalesce(current_setting('calechip.seed_target', true), '') <> 'local'`, raising with a hint at
`:43-46` that says the file *"may only be applied to a database you can throw away"*. Its 20-line
comment header at `:16-36` states the reasoning, including why it asks for an acknowledgement instead
of detecting the server (`:25-29`) and that it is deliberately **not** the drift detector ADR-024
declined (`:34-36`). The second command above can no longer be aimed at the hosted project at all.

**And `supabase/bootstrap.sql` replaced the act the seed used to serve.** ADR-030
(`ACCEPTED by tech-lead-design`, 2026-09-07, `:11`) decided its shape; `OPS-004` built it
(`.ai/board/tickets/OPS-004/ticket.yaml:8` — `state: DONE`, `feature_ids: [TEA-01]`;
`.ai/board/metrics.md:167` records the ship). The file carries no password and creates no auth user
(`supabase/bootstrap.sql:3-7`), and the sequence it serves is stated in its own header at `:9-12`:
admin zero signs up through the shipped interface, a human applies the file once, that admin
allow-lists everybody else. **A hosted project now has a documented way in that is not a seeded
account.**

**What half 1 leaves behind, and it belongs to somebody else.** `supabase/seed.sql` may now only be
applied to a disposable database, **and this repository has none**. There is no `supabase/config.toml`
and therefore no local stack and no `db reset` flow — stated at `seed.sql:20-22` and re-measured at
`ADR-030:85-87` — so the guard's own hint asks for a `$LOCAL_DB_URL` that nothing here supplies. The
work that would provide one is **Appendix A of `.ai/board/tickets/TEA-01/02-design.md:840`**, which
`.ai/board/tickets/OPS-004/ticket.yaml:234-246` records as having **no ticket and no ID**. That is a
real standing gap; it is named in three places already, and it is exactly the item this file's
`## Out of scope` fenced off.

## 3. Half 2 — *the repository actively tells them those credentials work*

**Partly covered, and the uncovered part is smaller and different from what this file described.**

**The surface grew rather than shrank.** This file counted four spec files at `:102-104`. Today
`thanh@example.com` appears in **sixteen** end-to-end spec files and in the fixture module:
`tests/e2e/tea-05-sign-in.spec.ts:10,16`, `cal-01-create-entry.spec.ts:16,20`,
`cal-02-edit-delete-entry.spec.ts:22,28`, `cal-03-admin-edit-entry.spec.ts:29,37`,
`cal-04-month-view.spec.ts:34,43`, `cal-05-week-view.spec.ts:41,50`, `cal-06-year-view.spec.ts:41,52`,
`cal-07-overload-warning.spec.ts:38,51`, `cal-08-holiday-shading.spec.ts:62`,
`adm-01-threshold.spec.ts:31,40`, `adm-02-holidays.spec.ts:52,58`, `adm-03-holiday-writes.spec.ts:34,38`,
`adm-04-worklist.spec.ts:34,62`, `adm-05-approve-reject.spec.ts:50,56`,
`adm-06-bulk-reject.spec.ts:54,60`, `uie-07-week-absence-count.spec.ts:38`, and
`src/lib/fixtures.ts:246`.

**But what those files claim is now true of the database they name.** `playwright.config.ts:49-52`
pins `VITE_DATA_SEAM: "mock"` and `VITE_SUPABASE_URL: ""` on the `webServer`, and the spec headers
cite the mock's own fixture module first — `tests/e2e/cal-01-create-entry.spec.ts:15` reads
*"Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql)"*. Against the seam the suite drives,
those credentials work. **The spec files are not lying about the suite**, and the framing in
`## Problem` — *"every signal a reader can check says the account is there"* — is now too strong.

**What is genuinely still missing is one sentence, and it is two hops away from the reader.** A person
who reads `tests/e2e/tea-05-sign-in.spec.ts:10` and follows the citation reaches
`src/lib/fixtures.ts:1-9`, which says the seed *"inserts the SAME rows with the SAME literals"* and
**names no database**. Only on the second hop, at `supabase/seed.sql:16-49`, do they learn that these
accounts may exist in a throwaway database and nowhere else. Between those two hops sits the person
who typed the address into the running product and got *"Email hoặc mật khẩu không đúng."*

**That residue is one comment in one shipped file, and it is not ticketed here — see § 4.**

> ***AMENDED 2026-09-08 AT § 8. THE RESIDUE IS SMALLER STILL: FOR A FRESH CLONE THE DOCUMENTED
> CREDENTIALS SIMPLY WORK.*** `.env` is untracked and `.gitignore:21-23` ignores `.env` and `.env.*`
> while exempting `!.env.example` — **and no `.env.example` exists**, verified on disk: the working
> tree holds `.env` and `.env.local` and nothing else. So a clone carries no `VITE_SUPABASE_URL`, and
> `src/lib/data/index.ts:777` resolves
> `usesMock = VITE_DATA_SEAM === "mock" || !VITE_SUPABASE_URL` — **true**, so `:786` binds the seam to
> the mock. `src/lib/data/mock.ts:794-800` answers `signIn` from
> `[...FIXTURE_CREDENTIALS, FIXTURE_APPROVED_MEMBER_CREDENTIAL]`, and `thanh@example.com` is at
> `src/lib/fixtures.ts:246-248` with `FIXTURE_PASSWORD` = `"password123"` at `:204`.
> **`thanh@example.com` / `password123` signs in, on the default build, for anybody who clones this
> repository.** Only a machine carrying its own `.env.local` — which is what the 2026-09-03 session
> was measuring against — sees the refusal. The half of the problem that reads *"the repository
> actively tells them those credentials work"* is, for the build everybody actually gets, **simply
> true**. This strengthens the REJECT rather than weakening it.

## 4. Why the residue does not become a ticket

Four reasons, in descending weight:

1. **The only substantive answer left is out of scope by this file's own words.** With the guard in
   place, `seed.sql` is applicable to nothing that exists, so "where does a developer run this product
   against real data" resolves to the disposable test database — which `## Out of scope` at `:195-197`
   says *"may turn out to be the right answer to part of this, but it is not discharged here and must
   not be smuggled in"*, and which `.ai/board/tickets/BUG-001/ticket.yaml` §10 and MD-021 both defer as
   its own decision. A row written here would be that decision arriving through the side door.
2. **Four of the five `## Impact if ignored` bullets are now false or already owned.** *"The gap widens
   by one ticket every ticket"* (`:112-114`) is **false**: the two rosters are no longer meant to
   match, so growth in `seed.sql` creates no hosted-project drift. *"It is not only accounts"*
   (`:123-127`) and *"the drift runs in both directions"* (`:128-132`) are both **transcribed into
   ADR-024** — `:155-158` and decision point 4 at `:112-137` — and the second is owed to a human by
   `BUG-001` §10. *"The confidence cost compounds"* (`:133-136`) is **discharged**: the diagnosis this
   file said would otherwise be re-derived is now written down three times, in ADR-024 entire, in the
   seed guard's own header at `:16-36`, and in `supabase/bootstrap.sql:1-44`. Only *"it fails
   intermittently"* (`:115-122`) survives, and its first wrong hypothesis is now one file-read from
   being corrected.
3. **A comment-only edit to a shipped file is a shape this board has already declined twice**, and for
   a reason that applies here unchanged: `.ai/board/backlog.md:62-67` leaves
   `src/components/Sidebar.tsx:63-64` wrong on the grounds that *"correcting a comment there would put
   a shell file in `allowed_paths`, and RULE-03's guard cannot tell a comment from a rewrite."*
4. **It is available to a ticket that already holds the file.** The next ticket whose `allowed_paths`
   contains `src/lib/fixtures.ts` can add the sentence at no marginal cost. Recorded here so that
   ticket's plan can find it: **the sentence owed is one line in that file's header naming which
   database these accounts live in, and pointing at `supabase/bootstrap.sql` for a real project.**

## 5. The six open questions, each answered or left open, with what answered it

| # | Question | Status |
|---|---|---|
| 1 | Who owns applying the seed, and when? | **Answered, then superseded.** ADR-024 decision point 2 (`:81-93`) answered it — a human, owed at `/ship`, named and never performed, with the exact command. The guard at `seed.sql:37-49` then made that command inapplicable to a hosted project, so today **nobody applies `seed.sql` to anything that exists**, and the hosted-project act it served belongs to `supabase/bootstrap.sql` (`:22-31`, ADR-030 decision point 9). **One half is unwired:** ADR-024's owed edit to `.claude/commands/ship.md` has still not landed — verified on disk at this triage, `supabase` appears **zero** times in that file, exactly as `ADR-030:308-312` reported on 2026-09-07. So the naming step is decided and not mechanised, for both SQL files. |
| 2 | Is `seed.sql` meant to be re-runnable, and does it achieve it? | **Answered.** ADR-024 decision point 1 (`:69-79`): converge-only **is** the intended contract and not an artefact of `do nothing`. Re-running inserts what is missing and never corrects what is present, and a ticket that changes an existing seeded value must name the corrective statement in its plan. |
| 3 | What does re-seeding actually fire? | **Answered mechanically; the empirical half has lapsed.** ADR-024 decision point 4 (`:112-137`) works it through: `on conflict (id) do nothing` does not protect against a same-email/different-id row, GoTrue's unique index on `auth.users.email` makes such an insert **raise**, the file carries no `begin`/`commit`, so a failure leaves it partially applied — therefore a read-only human listing must precede the first application. It names the concrete case (`an@example.com`, `tests/e2e/tea-01-signup.spec.ts:26`) and the consequence that a consumed allow-list row will not be reset. **Nobody has re-applied the file**, and under the guard nobody will apply it to a hosted project, so the question is now moot where it was asked. |
| 4 | What is actually in the live project right now? | **Still open. Nobody has looked.** `TODO(verify):` — the answer is in a hosted console that no session here can read, and this agent holds no `Bash` tool. The obligation is now stated in three places rather than one: ADR-024 decision point 4, `BUG-001` `ticket.yaml` §10, and `supabase/bootstrap.sql:14-20`, which names the two queries and calls the listing *"an obligation and not a suggestion"*. Nothing on disk records it having been performed. |
| 5 | Should the repository detect this state at all? | **Answered, negatively and on the record.** ADR-024 decision point 3 (`:97-110`) — no gate compares the file to the project and none may be added under that ADR, because a comparison check **is** the deferred second-database decision. Its revert condition (`:186-192`) reopens the point if a dedicated test project is ever provisioned. |
| 6 | Does anything else make the same class of claim? | **Still open, and the surface is larger than this file thought.** Nobody has looked. Sixteen spec files and `src/lib/fixtures.ts` (§ 3), and one more of the same class found since: **`supabase/db.sql` §§ 9.1 and 9.2 are false** — they say `public.team` has no select policy and no update policy while `20260904100000_cal04_team_select.sql` and `20260905000000_adm01_team_threshold.sql` both shipped (`ADR-030:338-349`). Under ADR-026 that file is applied by hand to stand up a fresh project, so a person bootstrapping will believe two working screens are broken. **It has no row and no owner.** |

## 6. Four facts stated above on 2026-09-03 that are no longer true

Corrected here rather than edited in place, which is this repository's convention and the reason the
original text is left standing.

1. **`## Constraints already known` at `:162-166` says the Supabase CLI "is not installed"** and that
   *"just run the seed" is not a command anybody in this repository has run and documented*.
   **Both were already false when written.** ADR-024 measured the CLI installed at 2.116.0 the same
   day (`:53-58`, `package.json` devDependencies, `node_modules/.bin/supabase`) and found
   `supabase db query --file … --db-url …` present in its help. The stale source was
   `.ai/standards/tech-stack.md:84` and `:189-191`, which ADR-024 named as **owed to a human** at
   `:162-164` — not checked at this triage and possibly still owed.
2. **`## Problem` at `:34` says the address is written in "four end-to-end specs".** It is sixteen
   today, plus `src/lib/fixtures.ts` — § 3.
3. **`## Evidence` at `:95` cites `supabase/seed.sql:341` for the `thanh@example.com` insert.** That
   row is at **`:376`** today. Every other line citation into `seed.sql` in this file — `:103-104`,
   `:121`, `:479`, `:522` — has drifted by the same insertion and should be re-measured rather than
   quoted, notably `:121`, which is now inside the `allowed_email` insert and not the weak-password
   comment it was cited for. **Measured at the § 8 amendment:** the `admin@calachip.com` / `123456`
   pair this file cites as `:121` is at **`supabase/seed.sql:155-156`**, inside the block headed
   *"Operator's own admin account, added 2026-09-01 on direct instruction"* at `:129-140`.
4. **`## Problem` at `:39-43` says "every signal a reader can check says the account is there".**
   No longer so. `supabase/seed.sql:16-49` now says the opposite in terms, in the file that inserts
   the account.
5. ***ADDED AT THE § 8 AMENDMENT — and it is the largest of the five.*** **`## Problem` at `:33-36`
   generalises from one machine.** The measurement was taken on a host carrying its own `.env.local`;
   on a fresh clone the same credentials succeed, because the seam resolves to the mock. See the
   quoted block in § 3. The sentence *"A person cannot sign in to the running application with the
   credentials this repository tells them to use"* is true of the session that wrote it and false of
   the default build.

## 7. What this verdict did not do, and one thing it could not verify

- **No feature row was written**, no `ticket.yaml` was created, and `.ai/board/backlog.md` was not
  touched. That follows from REJECT and is stated because those three writes are what a PROMOTE would
  have produced. `## BACKLOG` in that file remains as `UIE-07`'s ship left it, and the four items its
  paragraph lists as outstanding are unchanged by this run.
- **No ADR was drafted.** § 1 gives the test that was applied.
- **`TEA-01`'s `TODO(project):` marker at `.ai/registry/features.md:126` was not struck**, although
  `OPS-004` has now shipped and that cell says the marker *"closes when this pull request does"*. The
  same cell says striking the sentence is *"a human's edit to registry prose under RULE-01"*. It is
  named here so it is not lost; it is not this verdict's to make.
- ~~**`TODO(verify): who added the seed guard, and under which ticket.**~~ `calechip.seed_target`
  appears in exactly four files — `supabase/seed.sql`, `ADR-030`,
  `.ai/board/tickets/OPS-004/ticket.yaml` and
  `.ai/board/ideas/2026-09-07-a-new-project-admits-nobody-and-has-no-way-in.md` — and **no ticket
  artifact on the board records writing it**. `OPS-004`'s shell asserts at `:101-105` that it was
  *"added under ADR-024"*, but ADR-024's own *Changed by this ADR* table at `:200` says of
  `supabase/seed.sql`: *"nothing. The file is correct as written."* ~~Settling this needs
  `git log -S'calechip.seed_target' -- supabase/seed.sql`, and this session holds no `Bash` tool.~~
  **The guard's authorship being unrecorded does not weaken the verdict** — the guard is on disk, it
  executes, and ADR-030 reasons from it — but a control this load-bearing arriving with no ticket
  behind it is worth one person's minute.

  > ***DISCHARGED 2026-09-08 AT § 8.*** The coordinator ran the command with `Bash`:
  > `5e01885`, **2026-09-04**, author **ming**, *"supabase/seed.sql: refuse to run unless the target
  > is acknowledged as disposable"*. **There is no ticket artifact because there was no ticket** —
  > the operator wrote the guard by hand, three days before `OPS-004` shipped. That resolves the
  > contradiction in the direction the ADR states: **ADR-024's change table at `:200` is the accurate
  > half**, and `OPS-004/ticket.yaml:101-105`'s *"added under ADR-024"* is a reasonable inference
  > that is not what happened. The finding stands and is now sharper: **the single control keeping
  > published passwords off the hosted project entered the tree with no ticket, no plan, no review
  > and no test.** Nothing in the loop is at fault — a direct operator commit is RULE-09's own
  > territory — but the guard is unexercised by anything, exactly as `ADR-030:266-276` says of
  > `bootstrap.sql`'s.

---

# § 8 — Amendment, 2026-09-08, after the `tech-lead-design` consult

**The verdict is unchanged: REJECT.** `tech-lead-design` returned its RULE-11 technical half after
§§ 1-7 were written and **reached REJECT independently**, so the ruling is concordant and is not
reopened here. What it surfaced is four facts that needed `Bash` — a tool this session does not hold
— each of which the coordinator re-verified before sending. RULE-14 makes them an amendment to this
artifact rather than an answer in chat; RULE-16 is why they are written out here rather than cited.

**Everything asserted below was re-verified by reading the file named, in this session**, except the
two `git` outputs, which are attributed to the coordinator and marked as such. Where the consult's
summary and the file disagreed, the file wins and the difference is stated.

## 8.1 The idea was ruled on in 2026-09-03, and the defect is a missing write-back

**Coordinator's `Bash`, quoted:**

```
git log --oneline --all -- .ai/board/ideas/2026-09-03-nobody-can-sign-in-...md
8ce455e chore: ADR-024 — the seed is human-applied and converge-only

git show --stat 8ce455e  →  2 files changed, 441 insertions(+)
    .ai/board/ideas/2026-09-03-nobody-can-sign-in-...md   +238
    .ai/registry/decisions/ADR-024-...md                  +203
```

**Verified from the ADR itself, on disk:** `ADR-024:21-27` opens *"A person cannot sign in to the
running application with credentials this repository documents"*, names this file by path at `:22`,
and reproduces its measurements at `:23-25`. Its `## Status` at `:11-12` reads
`ACCEPTED by tech-lead-design — 2026-09-03, at /triage`.

**So the 2026-09-03 `/triage` run produced a full ruling and simply never appended it here.** The
correction is applied to the verdict header above. Three consequences, and the third is the one worth
a person's attention:

1. **§§ 1-7 are a write-back, not a first ruling**, and their independent agreement with ADR-024 is
   evidence about the reasoning rather than a new decision.
2. **The `## Open questions` list was answered on the day it was written.** Questions 1, 2, 3 and 5
   are ADR-024's three decision points plus its decision point 4 — which is why § 5's table found
   them answered by a single document. That is not a coincidence and § 5 read it as one.
3. ***NOTHING ON THIS BOARD DETECTS AN IDEA THAT WAS RULED ON WITHOUT A VERDICT SECTION.***
   `scripts/check-docs.mjs` has no check over `.ai/board/ideas/**` for a `verdict` heading, and no
   command reads the directory looking for one — `/triage` is dispatched at a named file and
   `/next-ticket` reads `ticket.yaml` and `backlog.md`. So **a ruled-on idea and an unruled one are
   indistinguishable on disk**, which is precisely why this file was re-triaged five days later and a
   session was spent re-deriving a decision that already existed. **This is `/thuki`'s and it is not a
   ticket** — the fix shape is a D-check asserting that every file under `.ai/board/ideas/` carries a
   verdict heading, or an explicit marker saying it is still open. Recorded here; not acted on, and
   no model-debt row written, because `.ai/board/model-debt.md` is not this command's to write.

## 8.2 The guard is an assertion, not a detection — and ADR-030 overstates it

`supabase/seed.sql:39` tests
`coalesce(current_setting('calechip.seed_target', true), '') <> 'local'`. **It refuses an *unasserted*
target. It does not refuse a hosted one.** Setting the flag while pointed at production runs the file
in full, publishing nine bcrypt-hashed development passwords into a real project.

**The seed file itself is honest about this** and says so at `:25-29`, in capitals:
*"IT ASKS FOR AN ACKNOWLEDGEMENT RATHER THAN DETECTING THE SERVER, deliberately"* — because a local
Supabase stack is built to be indistinguishable from a hosted one, so a detector would fail open.
That reasoning is sound and this amendment does not argue with it.

**What is overstated is `ADR-030:20`**, which describes the guard as refusing *"to run anywhere but a
disposable database"*. It refuses to run anywhere the operator has not **claimed** a disposable
database. § 2 of this verdict inherited that phrasing; the mechanism is the flag, and the control is
the operator's own care at the moment of typing. **This does not change the REJECT** — a
one-flag-away barrier is still the decision that re-seeding a hosted project is forbidden — but § 2's
*"can no longer be aimed at the hosted project at all"* should be read as *"can no longer be aimed at
it without an explicit false assertion"*.

## 8.3 An accepted ADR publishes a handover command that no longer works

`ADR-024:91-92` hands the operator this, under *"The reply hands over a complete ask"*:

```
pnpm exec supabase db push  --db-url "$SUPABASE_DB_URL"
pnpm exec supabase db query --file supabase/seed.sql --db-url "$SUPABASE_DB_URL"
```

**The second line sets no `calechip.seed_target`**, so against the guard added at `5e01885` it now
raises on `seed.sql`'s first executing statement. Verified by reading both files in this session.

Neither document is wrong about its own subject: the ADR was written on 2026-09-03 and the guard
arrived on 2026-09-04. **The ADR has not been amended since** (`doc_version: 2`,
`last_updated: 2026-09-03`). So an `ACCEPTED` decision carries a copy-pasteable command that fails,
and the operator finds out by running it. `.ai/registry/**` is human-only under RULE-01 and this
agent may not touch it — **recorded, owed to a human**, and it belongs beside the `ship.md` edit
ADR-024 already owes (§ 5, question 1).

## 8.4 A new defect, named and deliberately not ticketed

**`supabase/seed.sql:155-156` seeds `admin@calachip.com` with the password `123456`, and that
address appears nowhere in `src/lib/fixtures.ts`** — `calachip` returns **zero** matches in that file,
verified by grep in this session; the only near-match is the team name `"CaleChip"` at `:24`.

**Why it matters, and it is this idea's own failure inverted onto the mock.** `src/lib/data/mock.ts`
answers `signIn` from `[...FIXTURE_CREDENTIALS, FIXTURE_APPROVED_MEMBER_CREDENTIAL]` and nothing else
(`:794-800`, with the reasoning at `:777-780`: *"the mock's refusals are the SEED's refusals rather
than a second story about who can sign in"*). The operator's admin account is in neither list.
**So on the default build — the one § 3's amendment shows everybody gets — that account is refused**,
while `thanh` and `quan` succeed. Same symptom as the 2026-09-03 measurement, opposite seam.

**Two things make this narrower than it first looks, and both are corrections to the consult's
framing:**

- **The absence is deliberate and documented.** `src/lib/fixtures.ts:200-202` states it: *"The
  operator's own account in the seed is deliberately absent from this module: it was added by hand on
  2026-09-01, it is not a fixture, and mirroring its credential here would put a development password
  in a file the tests import."* That is a good reason. **The defect is therefore not a lost row — it
  is that `supabase/seed.sql:9-11` makes a universal claim that another file knowingly breaks**:
  *"EVERY literal below also appears in src/lib/fixtures.ts."* One of those two comments has to give.
- **The domain is misspelled.** `admin@calachip.com` — `calachip`, against the product's `CaleChip`
  (`CLAUDE.md`, and `index.html:6` per `.ai/board/backlog.md:55-57`). Whether that is a typo or
  intended is unknown here.

**And the parity rule that should have caught it has no mechanism.** `.ai/standards/testing-standards.md`
§ *Fixtures* requires tests to share fixture data with the seed. Verified in this session:
`scripts/` references neither `supabase/seed.sql` nor `src/lib/fixtures.ts` — zero matches across the
whole directory, so `check-docs.mjs` has no check over either — and every mention of `seed.sql` under
`tests/` is a **comment in a header**, not an assertion (`tests/absence.test.ts:10,13`,
`tests/draft-entry.test.ts:17`, `tests/ui-language.test.ts:5,11`, and the *"mirrored in
supabase/seed.sql"* headers in the e2e specs). **Nothing anywhere compares the two files.** That is a
standing rule with no enforcement, and it is the same shape as ADR-024 decision point 3's finding one
layer up.

***THIS IS NOT TICKETED AND NO IDEA FILE WAS WRITTEN FOR IT.*** It is outside this idea's declared
scope — `## Out of scope` at `:200-203` explicitly fences off *"changing the fixture module"* — and it
wants its own `/triage` run in a `product` session, where the problem gets stated before it is judged.
Naming it here is the whole of what this verdict does with it.

## 8.5 What this amendment did not do

- **No feature row, no `ticket.yaml`, no `backlog.md` row.** REJECT is unchanged, so none of the three
  is owed, and § 8.4's defect is deliberately left for its own triage.
- **Nothing under `.ai/registry/**` was touched**, including the two things this amendment found owed
  there: ADR-024's broken handover command (§ 8.3) and ADR-030's overstatement of the guard (§ 8.2).
  Both are human plane under RULE-01.
- **Nothing was committed**, and nothing above `# Triage verdict` was edited except the front-matter's
  `consulted:` field, which RULE-11 requires and which is the enforcement point for this consult.
- **`TODO(verify):` still standing:** what the hosted project contains (§ 5, question 4) — a hosted
  console no session here can read; and whether `admin@calachip.com`'s domain is a typo or intended
  (§ 8.4), which is the operator's own knowledge and is in no file.
