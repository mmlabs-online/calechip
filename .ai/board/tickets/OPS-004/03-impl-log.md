---
ticket: OPS-004
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-07T21:09:29+07:00
inputs_read:
  - .ai/board/tickets/OPS-004/01-plan.md
  - .ai/board/tickets/OPS-004/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/seed.sql
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# OPS-004 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/bootstrap.sql` | created | The whole ticket: the one human-applied file that creates the first `team` row and the first admin `member` row for an auth user who already signed up | § 4, every item |
| `.ai/board/tickets/OPS-004/ticket.yaml` | modified | `state: BACKLOG` → `REVIEW` on PASS, per `.claude/commands/implement.md:60`. Ticket-folder path, exempt from `allowed_paths` by name at `scripts/check-allowed-paths.mjs:130-132` | — |

No file under `src/`, `supabase/migrations/`, `tests/` or `.ai/standards/` was opened for writing.
`git status --porcelain` outside the ticket folder is exactly one line, `supabase/bootstrap.sql`.

## Contract items

Section 4 of `01-plan.md` is one artefact with named parts rather than a numbered list, so each part
is cited by its heading. Line numbers are `supabase/bootstrap.sql`.

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| The artefact — one file, **one statement**, a single `do $$ … $$;` block | `supabase/bootstrap.sql:46-197` | Verified mechanically, not by eye: the whole file parses to exactly one top-level statement, a `DoStmt`. See *Verification run* |
| Inputs — two required settings, read with `nullif(btrim(coalesce(current_setting(…, true), '')), '')` | `:48-55` | Both wrappers are character-for-character the ones the table names |
| Invocations — both, editor first, verbatim in the header | `:22-31` | AC-13. The `psql` form is on one line rather than the plan's two, because a trailing `\` continuation is one keystroke away from a line that begins with `\` and AC-12 forbids that class of thing in this file |
| Resolution of the auth user, trimmed and lowercased on both sides | `:99-118` | AC-2, AC-3 |
| Count rather than assume, `> 1` raises naming the count | `:108-113` | The plan's stated payment for widening ADR-030 decision point 5's predicate |
| The team — `0` insert, `1` reuse, `> 1` raise | `:123-130`, `:174-181` | Split in two, deliberately. See *Deviations* |
| The member row — precedence AC-7, AC-8, AC-9, then insert | `:133-195` | The order is the contract and it is the order in the file |
| `display_name` / `avatar` derived as a marked copy of `…tea01_membership.sql:113-117` | `:190-192`, marked at `:42-44` and `:191` | AC-13's third sentence |
| Error and notice text — each names what was found; AC-2's message fixed verbatim | `:104` (verbatim), `:82`, `:88`, `:109`, `:126`, `:150`, `:164` | Every `raise exception` carries `using hint =`; AC-1's two hints name **both** invocations *and* the listing, the rest name the listing |
| Return type: none — no result set, three observable outputs | whole file | No success notice was added. The contract enumerates the outputs and a fourth one is not the Developer's to invent |

## Deviations from the design

`none` in substance. Two placements are worth stating so the reviewer does not have to diff intent
against code to find them; neither changes an outcome the plan specifies.

**1. The team count is read early, at `:123`, but the team is not written until `:174`.** § 4
presents the team table before the member precedence, and AC-6 is graded on the count, so the count is
taken in the plan's order. The *write* is moved to the far side of AC-7, AC-8 and AC-9 so that **no
row is inserted before every refusal has been decided**. The plan makes AC-10 true by atomicity —
one statement, so a later `raise` rolls the earlier insert back — and that argument still holds; this
ordering means AC-10 does not have to lean on it. It is strictly stronger and observationally
identical.

**2. AC-6 is evaluated before AC-7, and the plan does not say which wins.** The plan fixes exactly one
ordering for AC-7 — *"evaluated before AC-9"* — and fixes AC-7 as unconditional with respect to *other
active admins*. It says nothing about AC-7 against AC-6. Both readings were available and they differ
in one corner: a project that holds **two or more teams** *and* already has this uid bootstrapped as
an active admin. As built, that raises AC-6's message rather than emitting AC-7's notice. The reason
is that AC-6 exists so the file never acts inside a two-team project, and a silent success there would
report *"nothing to do"* about a project whose shape this file has just declined to reason about. AC-7
is preserved whole in every case the plan states, AC-10 holds either way — no row is written on either
branch — and the 1→2→3→4 precedence of § 4 is intact. **If the reviewer reads the precedence the other
way this is a one-line move**, from `:123-130` to below `:153`.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-07` | *Every entry belongs to exactly one member, and is counted only against the team that member belongs to.* This file is where the mapping INV-07 presumes comes from, and the two ways it could poison that mapping are both closed by a refusal rather than by care. A **second team row** would silently partition the roster and leave every downstream count correct against the wrong denominator: `:123-130` refuses `> 1` outright, and `:174-181` reuses the single existing row instead of inserting beside it — `on conflict do nothing` could not have expressed that, because `public.team` has no unique constraint on `name`. A **member row with no team** cannot occur: `team_id` is taken from `v_team_id` at `:189`, which is assigned on both branches of `:174-181` and on neither branch can be null. No `entry` row is written and no count is defined here, so INV-01 through INV-06 have nothing in this file to be true or false about |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | the typecheck named in `.ai/standards/testing-standards.md:16` |
| `pnpm exec eslint .` | 0 | `:17` |
| `pnpm exec vitest run` | 0 | `:18`. 10 files, 186 tests. Not touched by this ticket — run because a green baseline is what makes the empty diff under `src/` meaningful |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS, ticket resolved as OPS-004 from the branch — **and its PASS is vacuous here, which is worth knowing before it is relied on.** It enumerates `git diff --name-only origin/main...HEAD` (`:123`), so it sees committed history; ADR-006 leaves the whole ticket uncommitted until `/ship`, and it reported `0 changed file(s)`. It will grade this ticket for real at `/ship` and not before |
| `git status --porcelain` ⊆ `allowed_paths` ∪ ticket folder | yes | **this is the evidence, not the line above.** One path outside the ticket folder: `supabase/bootstrap.sql`, which is the single entry in `allowed_paths` |
| `node scripts/check-docs.mjs` | 0 | 0 errors. The 2 warnings and 3 pending rows are pre-existing and name other files; none is this ticket's |

**Node 22 is not this machine's `node`.** `/usr/bin/node` is v18.19.1 and both ESLint and Vitest fail
at startup on it with `SyntaxError: Unexpected token 'with'`, before reading any project file. The
two runs above were made with a Node 22.12.0 unpacked into the session scratchpad and prepended to
`PATH`. Nothing in the repository was changed to accommodate it — `.ai/standards/tech-stack.md` names
Node 22 and the standard is right; the machine is wrong, and a ticket in flight does not own the
toolchain.

### The two checks the gate does not run, and what was done instead

`01-plan.md` § 2, *What nothing verifies*, is exact: nothing in `scripts/`, `.claude/hooks/` or
`.github/workflows/` reads `supabase/`, there is no `supabase/config.toml` and so no local stack, and
ADR-024 decision point 3 forbids pointing a test at a real project. **No runner in this repository
executes this file, and none can.** Two things were therefore done that the gate does not ask for, and
their results belong here rather than in chat:

**1. The file was parsed by PostgreSQL's own grammar.** `libpg_query` (via `pglast` 8.4, installed in
the session scratchpad and not in this repository) reports the file as **exactly one top-level
statement, a `DoStmt`** — which is what makes AC-10 true by construction and is otherwise an assertion
nobody had checked — and parses the PL/pgSQL body clean. One substitution was needed to get that
second result and it is a limitation of the tool rather than a finding: a catalog-less parser cannot
resolve `public.member_role`, assumes any unresolvable type is a `record`, and then rejects
`select m.role, m.removed_at into v_role, v_removed_at` with *"record variable cannot be part of
multiple-item INTO list"*. Substituting `text` for that one declaration — the enum is a scalar on a
real database, where the catalog resolves it — the body parses with no diagnostic. **This is a
syntax check and nothing more. It executed no statement and touched no database.**

**2. AC-11, AC-12 and AC-13 were settled by `grep`, which is what they were written to be.**

| | Result |
|---|---|
| `encrypted_password`, or any write to the `auth` schema | no match |
| every email-shaped literal in the file | two, both inside the header comment, both `admin-zero@example.com` (`:25`, `:31`) — AC-11's placeholder carve-out and nothing else |
| tables written | `public.team` (`:175`), `public.member` (`:186`), and no other |
| tables read outside those two | `auth.users`, by `select`, at `:100` and `:117` |
| lines beginning `\` | none — AC-12 |
| first line | `-- OPS-004 bootstrap. Applied by a human (RULE-09), never by an agent.` — AC-13, mirroring `supabase/seed.sql:1` |

**AC-1 through AC-10 remain observable by a human applying the file and by nothing else**, exactly as
the plan says. The reviewer should read them, not expect to run them.

## Testability contract

Not applicable. `01-plan.md` has no section 6 selector table and no `data-testid` anywhere: this
ticket ships no interface (§ 1, § 2b). The QA stage that consumed this table was retired by ADR-022.

## Open questions

**1. `gates.plan` is still `false` and `state` was `BACKLOG` when this command ran.** `01-plan.md`
front-matter carries `gate: PASS` and `next_state: READY`, and `.claude/commands/plan.md:114-115` is
explicit that PLAN sets nothing about state — the orchestrator grades the Definition of Ready and
moves the ticket. That never happened here: this ticket went `BACKLOG` → (this command) → `REVIEW`,
skipping READY and IN_PROGRESS, and `gates.plan` at `ticket.yaml:27` still reads
`{ passed: false, at: null }`. **`/ship` requires `plan` and `review` both `passed: true` with
timestamps** (`.claude/commands/ship.md:12`, `.ai/01-operating-model.md:349`), so the ticket cannot
ship until someone records the plan gate. Recording another stage's gate is not the Developer's, so
it was left alone rather than filled in quietly. **This is for the operator or the orchestrator, and
it is not a defect in the code under review.**

**2. Nothing in the repository will notice when this file goes stale.** `01-plan.md` § 6 accepts this
and does not mitigate it, and this log cannot close it either — it is recorded once more here only
because the failure lands on a person standing up a project, which is the worst possible moment: the
file names `public.team (name)` and `public.member (id, team_id, display_name, avatar, role)`, and the
first migration that adds a `not null` column without a default to either table breaks it silently.
