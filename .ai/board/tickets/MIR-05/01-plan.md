---
ticket: MIR-05
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-21T17:08:32+07:00
inputs_read:
  - .ai/board/tickets/MIR-05/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/standards/architecture.md
  - .ai/standards/tech-stack.md
  - .ai/standards/testing-standards.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/board/estimates/2026-09-04-supabase-to-sqlite.md
  - .github/workflows/verify.yml
  - docs/ops/branch-protection.md
  - supabase/seed.sql
  - package.json
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-05 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md:294`:**

| ID | Title | Group | Status |
|---|---|---|---|
| MIR-05 | pgTAP runs locally and in CI against a real Postgres with every migration applied | MIR | PLANNED |

**Plan item P1-1, transcribed from `.ai/board/plans/calechip-multi-tenancy-plan.md:107-110`:**

- Add `supabase/tests/` and wire pgTAP into local Supabase
- Add a CI job that starts a real Postgres, applies all migrations, and runs the SQL tests
- CI fails on any SQL test failure

**Why it matters.** ADR-005 makes row-level security the sole authorization mechanism, and
`architecture.md:97-99` says the permission-model test executes against a real PostgreSQL. Today no
test does: the audit (A:879-911) records that every isolation assertion runs against the mock, CI
runs only vitest and Playwright, and there is no `supabase/config.toml`, so no local stack exists.
MIR-02, MIR-03 and MIR-04 each shipped a manual `verification.md` "until MIR-05 lets pgTAP run
them". This ticket gives the **developer and the reviewer** one command that builds a disposable
Postgres from every migration and runs SQL tests against it, and gives **CI** the same command as a
gate. It writes the harness, not the suite.

**Out of scope.**

- **The isolation suite** (P1-2) — MIR-06. Its ticket records the operator's decision that MIR-06
  does not wait for this one (`MIR-06/ticket.yaml:65`).
- **Porting the manual checks** in `MIR-02/03/04/verification.md` to pgTAP — MIR-06, which owns
  the boundaries they test.
- **Fixing the mock** (P1-3) and **un-pinning Playwright from the mock** (`tests/e2e/seam.setup.ts`).
- **Reconciling `config.toml` with the hosted project's auth settings** (e.g.
  `enable_confirmations`, estimate §4.1). Only what pgTAP needs is changed.
- **Changing the workflow triggers.** The operator's temporary `release/**`-only trigger
  (`verify.yml:13-19`) stands; see the note under § 2.
- **Any migration, policy or seed change.** `seed.sql`'s guard is left exactly as it is.
- **Standards edits** — the role row in `testing-standards.md` and the CLI line in `tech-stack.md`
  are human-plane; named in § 7.

`size_estimate: M` — eight files, but the first `supabase start` on a fresh runner carries the
unknowns the estimate (§4.3) budgeted half a day to a day for.

## 2. Acceptance criteria

**AC-1 — one local command runs the SQL tests against every migration**
- Given a machine with Docker running and `pnpm install` done
- When the operator runs `pnpm db:test`
- Then a local Supabase database is rebuilt from every file in `supabase/migrations/` in filename
  order, every `*.test.sql` file under `supabase/tests/` is run with pgTAP, a TAP summary is printed,
  and the command exits 0 when every assertion passes.

**AC-2 — a failing assertion fails the command**
- Given a test file under `supabase/tests/` containing an assertion that fails
- When `pnpm db:test` runs
- Then the failing assertion is named in the output and the command exits non-zero.

**AC-3 — a migration that does not apply fails the command before any test runs**
- Given a file in `supabase/migrations/` that raises an error when applied
- When `pnpm db:test` runs
- Then the command exits non-zero, the migration's error is printed, and no pgTAP test is reported
  as passing.

**AC-4 — the harness proves itself**
- Given the repository as shipped by this ticket
- When `pnpm db:test` runs
- Then at least one committed test passes, and it asserts that pgTAP is executing, that
  `supabase_migrations.schema_migrations` records at least one applied migration, and that
  `public.team` and `public.member` exist.

**AC-5 — the command never targets a hosted project** (ADR-024 decision point 3)
- Given any of `--linked`, `--db-url` or `--project-ref` passed to `pnpm db:test`
- When it runs
- Then it prints a refusal naming the argument, exits 2, and starts, resets or tests nothing.

**AC-6 — the shipped seed is not applied, and its guard is untouched**
- Given `supabase/seed.sql` unchanged, with its `calechip.seed_target` guard
- When `pnpm db:test` resets the database
- Then the seed is not applied and the reset does not fail on the guard.

**AC-7 — CI runs the same command and blocks on it**
- Given a workflow run of `verify.yml`
- When the `database` job runs
- Then it executes `pnpm db:test` on a GitHub-hosted runner, requires no secret and no
  `environment`, and the aggregate `verify` job fails whenever `database` fails, is skipped or is
  cancelled — exactly as it does for `static`, `scripts` and `e2e`.

**AC-8 — the existing gates are unchanged**
- Given the change applied
- When `static`, `scripts` and `e2e` run
- Then their steps are byte-identical to before; the required check is still the single job
  `verify` (`docs/ops/branch-protection.md`).

**Note on observing AC-7.** Under the operator's temporary trigger, `verify.yml` runs on
`release/**` only, so this ticket's pull request to `main` will not run it. AC-7 is observed by
reading the workflow at review, and by the first run on a `release/**` branch. AC-2 and AC-3 are
observed once by the developer with a temporary file, removed before the checkpoint, and recorded
with its output in `03-impl-log.md`.

**Invariants touched: `[]`.** No table, policy, trigger, constraint or seam function changes; the
harness asserts no invariant. INV-01 to INV-07 become testable here and are tested by later tickets.

**Open questions.** None that change an AC. Two `TODO(verify)` for the developer, neither of which
moves a criterion:

- `TODO(verify):` whether `supabase test db` creates the `pgtap` extension itself. The harness test
  creates it inside its own transaction regardless (§ 4.3), so the answer only decides whether that
  line is redundant.
- `TODO(verify):` that excluding the containers listed in § 4.2 still lets `db reset` complete. If one
  of them is needed, drop it from the list and say so in the impl log.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(There is no screen in this ticket. The line stands because the section requires one of its two.)

## 3. Permission model

No role gate is added, removed or changed. No application role reaches anything this ticket builds.

- **The test database is disposable and local.** It runs as the local stack's superuser, which is
  correct for a harness and says nothing about production grants. Tests that need a role (MIR-06
  onward) switch to it with `set local role` / `request.jwt.claims` inside their own transaction.
- **Denial: no hosted project, ever.** AC-5. The wrapper always passes `--local` and refuses the
  three flags that would point it elsewhere. CI holds no Supabase secret and declares no
  `environment` (AC-7), so a CI job cannot reach the hosted project even by mistake.
- **Denial: no published password reaches any database through this path.** AC-6 — the seed is
  disabled in `config.toml`, and its guard (`seed.sql:37-49`) is not weakened to make reset pass.

## 4. Contract

### 4.1 `package.json`

One script added, nothing else changed:

```json
"db:test": "node scripts/db-test.mjs"
```

### 4.2 `scripts/db-test.mjs`

Windows-native (`CLAUDE.md` § Working agreements): `.mjs`, run by `node`, no shell features. Spawns
the CLI with `pnpm exec supabase …` via `child_process.spawnSync` with `{ stdio: 'inherit', shell:
process.platform === 'win32' }`.

```js
// Exported for scripts/tests/db-test.test.mjs; runs main() only when executed directly.
export const REFUSED_FLAGS = ['--linked', '--db-url', '--project-ref'];

/** Returns the first refused flag found in argv (exact match or `<flag>=…`), or null. */
export function refusedFlag(argv /* string[] */) /* string | null */;

/** The three CLI invocations, in order. Pure; no I/O. */
export function steps() /* Array<{ name: string, args: string[] }> */;
// returns exactly:
// [
//   { name: 'start', args: ['start', '-x', 'studio,imgproxy,logflare,vector,edge-runtime,realtime,storage-api,mailpit'] },
//   { name: 'reset', args: ['db', 'reset', '--local'] },
//   { name: 'test',  args: ['test', 'db', '--local', 'supabase/tests'] },
// ]
```

`main(argv)` behaviour:

1. `refusedFlag(argv)` non-null → `console.error('db:test refuses ' + flag + ': this command only targets the local stack (ADR-024).')`, exit **2**, spawn nothing.
2. Run each step in order. The first step with a non-zero status → print `db:test: <name> failed (exit <n>)`, exit with that status. No later step runs (AC-3).
3. All three zero → exit 0.

It does **not** stop the stack afterwards; a running stack is reused by the next `start`.

### 4.3 `supabase/tests/000-harness.test.sql`

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select pass('pgTAP is executing');
select ok(
  (select count(*) from supabase_migrations.schema_migrations) > 0,
  'at least one migration is recorded as applied'
);
select has_table('public', 'team',   'public.team exists');
select has_table('public', 'member', 'public.member exists');

select * from finish();
rollback;
```

### 4.4 `supabase/config.toml`

Generated by `pnpm exec supabase init`, committed as generated, with **one** edit: under
`[db.seed]`, `enabled = false`, with a comment citing AC-6 and `seed.sql:16-49`. `project_id` is
whatever `init` writes. `supabase/.gitignore`, if `init` writes one, is committed as generated.

### 4.5 `.github/workflows/verify.yml`

A new job, inserted after `scripts`:

```yaml
  database:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: database tests
        run: pnpm db:test
```

No `environment:` key, unlike its siblings — it needs no secret (AC-7). The `verify` job becomes:

```yaml
    needs: [static, scripts, database, e2e]
    ...
        env:
          STATIC: ${{ needs.static.result }}
          SCRIPTS: ${{ needs.scripts.result }}
          DATABASE: ${{ needs.database.result }}
          E2E: ${{ needs.e2e.result }}
        run: |
          echo "static=$STATIC scripts=$SCRIPTS database=$DATABASE e2e=$E2E"
          [ "$STATIC" = success ] && [ "$SCRIPTS" = success ] && [ "$DATABASE" = success ] && [ "$E2E" = success ]
```

The header comment's job list gains `database`.

### 4.6 `scripts/tests/db-test.test.mjs`

`node:test`, picked up by the existing `scripts/tests/*.test.mjs` glob. Covers AC-5 without Docker:
`refusedFlag` returns each of the three flags in both `--flag value` and `--flag=value` form and
`null` for `[]`; `steps()` returns the exact array in § 4.2, with `--local` on `reset` and `test`.

### 4.7 `docs/ops/branch-protection.md`

Line 27's row and the job list at line 35 name `database` alongside `static`, `scripts` and the
`e2e` shards. The required check stays `verify` alone.

## 5. Seam impact

None. `src/lib/data/` is not touched; nothing in `src/` changes.

## 6. Schema delta

`none`. No migration is added or edited. `config.toml` configures the local stack only; it is not
read by the hosted project.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/config.toml"
  - "supabase/.gitignore"
  - "supabase/tests/000-harness.test.sql"
  - "scripts/db-test.mjs"
  - "scripts/tests/db-test.test.mjs"
  - "package.json"
  - ".github/workflows/verify.yml"
  - "docs/ops/branch-protection.md"
  - ".ai/board/tickets/MIR-05/**"
```

`size: M` — eight paths outside the ticket folder. Agrees with `size_estimate`.

`glossary_owed` is `[]`; no rows written.

**Owed to the human plane, not writable here:** `testing-standards.md:14-22` should gain a `database`
role row (`pnpm db:test`), since `verify.yml`'s own header says that table is the only file that knows
the invocations; and `tech-stack.md`'s Migrations row (`TODO(project) — CLI not installed yet`) and
Postgres major become answerable once `config.toml` exists. Both are for the operator under RULE-01's
plane rules, after this merges.

## 8. Rejected alternatives

**A plain `postgres` service container in CI, migrations applied with `psql`.** Faster to start and
no Docker-in-runner dependency on the CLI. Rejected because every migration depends on objects a
vanilla Postgres lacks — `auth.users`, `auth.uid()`, the `authenticated`/`anon` roles, the
`extensions` schema (estimate §4.1) — so the job would have to stub them, and a stubbed `auth`
schema is a second, hand-written copy of the thing the tests exist to exercise. It also gives the
local machine and CI two different paths, which AC-1 and AC-7 deliberately make one.

**Setting `calechip.seed_target=local` for the reset instead of disabling the seed.** Would let tests
reuse the shared fixtures. Rejected: it publishes the guard's acknowledgement into committed config,
so any `db reset` from this directory — including one with a mistaken target — would pass the guard
the seed exists to enforce. MIR-06 can decide how its tests get fixtures, inside a rolled-back
transaction.

**Putting `create extension pgtap` in a migration.** Rejected: it would ship a test extension to the
hosted project and make this ticket a schema delta for no product reason.

## Changelog

- 2026-10-21T17:08:32+07:00 — sections 1-8 written. Raised by tech-lead-design.
