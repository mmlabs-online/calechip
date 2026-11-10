---
doc_version: 3
last_updated: 2026-09-03
governed_by: [RULE-01, RULE-03, RULE-09]
---

# ADR-024 — `supabase/seed.sql` is human-applied and converge-only, and nothing compares it to the project

## Status

`ACCEPTED by tech-lead-design` — 2026-09-03, at `/triage`, under ADR-008 and
`.claude/commands/triage.md:49`.

Accepted rather than referred, because every clause below sits **inside** what ADR-005, ADR-021 and
`.ai/board/tickets/BUG-001/ticket.yaml` §10 have already decided. Decision point 3 is the load-bearing
one and it is a *re-closing*, not an opening: it forbids the mechanism those documents defer, in the
same terms they defer it. Nothing here supersedes or reverses an accepted ADR.

## Context

A person cannot sign in to the running application with credentials this repository documents.
`.ai/board/ideas/2026-09-03-nobody-can-sign-in-with-the-credentials-the-repository-documents.md`
carries the measurements: `thanh@example.com` / `password123` returns HTTP 400 `invalid_credentials`
against the project named in `.env`, `quan@example.com` / `password123` returns HTTP 200, and
`git log -S` dates `quan` to TEA-01 and `thanh` to TEA-05. The hosted project was seeded once, around
TEA-01, and never again. `supabase/seed.sql` has grown with almost every ticket since and is now 542
lines.

**No component of the product is defective.** `src/lib/data/supabase.ts:207` maps
`invalid_credentials` correctly and `src/routes/SignIn.tsx:95` renders it; a nonexistent account
*should* be refused that way. The file and the database are two different rosters, nobody declared
them to be, and nothing in the repository compares them.

Three questions were left unanswered by every existing document, and each one binds future tickets:

1. **Is the seed meant to be re-runnable, and what is the contract?** Every statement is
   `on conflict … do nothing` — 21 clauses, 20 on `(id)` and one on `(email)` at `supabase/seed.sql:89`.
   That last one is not an inconsistency: `allowed_email` has no `id` column,
   `supabase/migrations/20260831150024_tea01_membership.sql:42` makes `email extensions.citext primary key`.
   The file is uniformly *conflict on the primary key, do nothing*.
2. **Who applies it, and at what moment?** `supabase/seed.sql:1` says "Applied by a human (RULE-09),
   never by an agent", which settles *who*. Nothing anywhere settles *when*. No stage owns it, `/ship`
   does not, and no Definition of Done item mentions it — so the drift restarts with the next ticket
   that appends a fixture.
3. **May the repository detect this state at all?** Today the only detector is a human typing a
   password. `.ai/board/tickets/BUG-001/ticket.yaml` §5 records that a pinned build contains zero
   occurrences of `supabase.co` and is structurally incapable of reaching the live project, so the
   end-to-end suite is green and says nothing whatever about the hosted database. That pin is
   deliberate and is not a thing to undo.

**Two facts measured in this run change what is available, and both correct a document.**

- **The Supabase CLI is installed.** `package.json` carries `"supabase": "^2.116.0"` in
  `devDependencies`; the binary is at `node_modules/.bin/supabase` and reports `2.116.0`. It is not on
  the global `PATH`, which is what earlier readings observed.
  `.ai/standards/tech-stack.md:84` still says "CLI not installed yet" and `:189-191` still lists the
  CLI on its *Still unverified* list. **Both are now stale.** That file is standards plane and is not
  edited by this ADR; the correction is owed to a human.
- **An apply command exists and takes a connection string directly.**
  `supabase db query --file <path> --db-url <conn>` and `supabase db push --db-url <conn>` are both
  present in the installed CLI's help. `--include-seed` reads seed data *from config*, and there is no
  `supabase/config.toml` in this repository (`supabase/` holds `migrations/`, `seed.sql` and the
  CLI's own `.temp/`), so `--include-seed` is not the path; `db query --file` is. So "just run the
  seed" **is** a command this repository can express — it is simply one nobody has run or written
  down.

## Decision

**1. `supabase/seed.sql` is converge-only, and that is the intended contract rather than an artefact
of `do nothing` being the easy clause to write.**

Re-running it inserts what is missing and silently skips what is present. A row already in the
project **keeps whatever values it has**, forever. A changed password, `display_name`, `role`,
`consumed_at` or `removed_at` in the file will never propagate to a project that already holds that
primary key.

Therefore: **a ticket that changes an existing value in `supabase/seed.sql` must say so in its plan's
Out-of-scope or Open-questions section, and name the corrective statement a human must run.** Adding
a new row needs no such note. This is the only new obligation this ADR places on a ticket.

**2. Applying the seed is a human action, owed at `/ship`, and named rather than performed.**

When a ticket's diff touches `supabase/seed.sql` or `supabase/migrations/`, `/ship` **names the owed
operator action in its reply**, with the exact command and the paths. It does not run it, and no agent
runs it — RULE-09, and `supabase/seed.sql:1`.

The reply hands over a complete ask, per the standing instruction in `.ai/steward/context.md`
§ How to answer:

```
pnpm exec supabase db push  --db-url "$SUPABASE_DB_URL"          # migrations first
pnpm exec supabase db query --file supabase/seed.sql --db-url "$SUPABASE_DB_URL"
```

This is a repair, not a detector. It is chosen knowing that.

**3. No gate compares the file to the project, and none may be added under this ADR.**

The end-to-end suite stays pinned to the mock seam. Any check that reads the hosted project needs a
credential that can enumerate `auth.users` and `public.member`. The anon key cannot:
`supabase/migrations/20260831150024_tea01_membership.sql:145` revokes all on those tables from `anon`,
and `:146-147` grants `select` to `authenticated` only. That leaves the service-role key or the
database URL, and `.ai/standards/rbac-and-security.md:128` says the service-role key must never be
committed and is the whole authorization model in a single string under ADR-005.

So a comparison check **is** the second-suite-against-a-real-database decision that
`.ai/board/tickets/BUG-001/ticket.yaml` §10 and MD-021 defer — a project to provision, a lifecycle,
and credentials in CI. This ADR does not take that decision. It records that the decision is what
stands between the repository and a detector, so that the next triage does not re-derive it and
arrive somewhere worse.

**4. Re-running the seed is not a safe blind repair when the project may hold rows that are in no
file.**

`on conflict (id) do nothing` protects against a row with the same **id**. It does not protect against
a row with the same **email** and a different id: GoTrue's `auth.users` carries a unique index on
`email`, so such an insert **raises** rather than being skipped, and the dependent `member` insert then
fails its foreign key — `member.id` references `auth.users (id)`, migration `:32`, and
`:49-50` records that there is no cascade anywhere in this model. The file is **not wrapped in a
transaction** — it contains no `begin` and no `commit` — so a failed statement leaves it partially
applied.

Therefore: **the first application after any period during which the project may have been written by
something other than this file must be preceded by a read-only listing, performed by a human.**
`.ai/board/tickets/BUG-001/ticket.yaml` §10 already owes that listing. Two concrete reasons it is not
hypothetical here:

- `tests/e2e/tea-01-signup.spec.ts:26` signs up as `an@example.com`, which is
  `FIXTURE_ALLOWED_EMAIL` (`src/lib/fixtures.ts:36`). Every unpinned acceptance run before BUG-001
  landed did that against the live project, and `admit_allow_listed_member` sets `consumed_at`
  (migration `:101-105`) and inserts a `member` row (`:111-122`). So the project very likely holds a
  **consumed** allow-list row for `an@example.com` and a `member` row for it. `on conflict (email) do
  nothing` at `supabase/seed.sql:89` will **not** reset `consumed_at`, so TEA-01 AC-3's fixture stays
  wrong in the project after a re-seed.
- That extra `member` row enters **INV-04's denominator**, which is the team's members with
  `removed_at is null`. The live project's overload threshold therefore already differs from the one
  every test assumes, and re-seeding the missing members moves it again.

**5. `.gitignore:17-20` records a live `SUPABASE_SERVICE_ROLE_KEY` committed at `5a29434`.**
Decision point 4 applies to that period with full force, and its remedy is rotation, which
`.ai/standards/rbac-and-security.md:152` already names as the only one. That is incident
response and an operator action; it is **not** decided by this ADR and does not wait on it.

## Consequences

- **The drift is still only detected by a human typing a password.** This is accepted deliberately and
  is the whole cost of decision point 3. Nothing here makes the state observable; it makes it
  repairable and makes the repair someone's.
- **Every ticket that appends a fixture now carries an owed operator action.** That is friction, it
  will sometimes be skipped, and when it is skipped the failure mode is exactly the one this ADR is
  about — one ticket further behind, discovered by the next person to type a password. A named,
  skippable step is strictly better than an unnamed one, and strictly worse than a check. It is what
  is available.
- **Manual verification of shipped features stays a subset of what was built** until the accumulated
  unapplied seed is applied once. `supabase/seed.sql:479` (CAL-02's approved entry) and `:522`
  (CAL-03's other-team entry) are unreachable through the product by design — no policy grants
  `status` — so against the live project the states those tickets exist to handle cannot be reached at
  all.
- **Decision point 1 makes a class of ticket more expensive**: changing a seeded value now requires a
  hand-written corrective statement in the plan. That is a real tax on a real case, and it replaces a
  silent no-op that nobody would have noticed.
- **`.ai/standards/tech-stack.md:84` and `:189-191` are left factually wrong by this ADR**, which
  measures the CLI as installed but may not edit standards plane (`tech-stack.md:205-207`). The
  correction is owed to a human and is named here so it is not lost.

## Alternatives rejected

**A CI check that reads the project and diffs it against the file.** The right mechanism, and the one
that would actually have caught this. Rejected because it cannot be built inside the current envelope:
it needs a credential no place in this repository may hold (decision point 3), and reaching for one is
the deferred decision rather than a step toward it. Named as the alternative rather than omitted,
because the next reader will think of it first and deserves the reason it is not here.

**A shell script under `scripts` that a human runs.** Rejected as redundant. The installed CLI already
expresses the command in one line; a wrapper would add a file to maintain and a second place for the
connection string to appear.

**Do nothing but write the diagnosis down.** Free, and it discharges the confidence cost — the next
person does not re-derive that the seed file, the fixture module, the error mapping and the sign-in
form are all correct. Rejected **as the whole answer**, because it leaves question 2 unanswered and
the drift restarts with the next ticket. It is kept as a component: this document is that record.

**Making sign-in distinguish "no such account" from "wrong password".** The obvious framing and the
wrong one. It has a security argument attached and it is a different question.

## Revert condition

**If a dedicated test project is ever provisioned under the separate decision that
`.ai/board/tickets/BUG-001/ticket.yaml` §10 defers**, decision point 3 is reopened: a credential with a
place to live exists, the comparison check in *Alternatives rejected* becomes buildable, and this ADR
is superseded rather than amended. Decision points 1, 2 and 4 survive that change — they are about the
file's contract and about who touches production, neither of which a test project alters.

## Changed by this ADR

| File | Change | Plane |
|---|---|---|
| `.claude/commands/ship.md` | `/ship` names the owed apply action when the diff touches `supabase/**` | agent |
| `.ai/standards/tech-stack.md` | `:84` and `:189-191` are stale — the CLI is installed at 2.116.0 | **human, owed** |
| `supabase/seed.sql` | nothing. The file is correct as written. | — |

Neither edit is made by this ADR. The first is `ops/<slug>` steward work; the second is human plane
under RULE-01 and `tech-stack.md:205-207`.
