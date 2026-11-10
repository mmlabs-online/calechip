---
ticket: OPS-004
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-07T22:17:26+07:00
inputs_read:
  - .ai/board/tickets/OPS-004/01-plan.md
  - .ai/board/tickets/OPS-004/03-impl-log.md
  - .ai/board/tickets/OPS-004/ticket.yaml
  - supabase/bootstrap.sql
  - supabase/migrations/20260831150024_tea01_membership.sql
  - .ai/registry/invariants.md
  - .ai/01-operating-model.md
  - eslint.config.js
  - scripts/check-allowed-paths.mjs
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# OPS-004 — review report

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `supabase/bootstrap.sql:1` is the only working-tree path outside `.ai/board/tickets/OPS-004/`, and it is the single entry at `.ai/board/tickets/OPS-004/ticket.yaml:18`. The ticket folder is exempt by name at `scripts/check-allowed-paths.mjs:132` |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0, re-run by this review under Node 22.12.0 |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0, re-run by this review under Node 22.12.0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | The rule fires on an import of `@supabase/*` from anywhere under `src/` other than the seam (`eslint.config.js:64-73`). This ticket adds no file under `src/` and no import of any kind; `supabase/bootstrap.sql:46` is a `do $$` block a human applies to the database outside the running application, and no component reaches it |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | Row by row below |
| R6 | Permission gating matches plan section 3 | PASS | `01-plan.md` § 3 asserts no product role gains anything and no callable object is left behind. `grep -niE 'create (policy\|function\|role)\|grant \|revoke \|security definer\|alter table' supabase/bootstrap.sql` returns nothing — the file creates no policy, grant, role or function. The only writes are `supabase/bootstrap.sql:175` and `:186`; the only foreign read is `auth.users` by `select` at `:99-101` and `:115-118`. The privileged context is the connection, not the code, exactly as § 3 states |
| R7 | No invariant violated (RULE-07) | PASS | Per-ID below |
| R8 | No dependency added without an ADR | PASS | `package.json` and `pnpm-lock.yaml` are absent from `git status --porcelain` — neither is modified. The only added file is SQL. `03-impl-log.md:120-127` discloses `pglast` as installed in the session scratchpad and not in this repository; `grep -n pglast package.json` returns nothing |

## R5 detail

`01-plan.md` § 4 is one artefact with named parts rather than a numbered list, so each part is cited
by its heading. Unqualified line numbers are `supabase/bootstrap.sql`.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| The artefact — one file, **one statement**, a single `do $$ … $$;` block | `:46-197` | Yes. The file holds one `do` block and nothing else; the 45 lines above it are comment. No `begin`/`commit` for the editor to fight, which is what makes AC-10 true by construction |
| Inputs — two required settings, read as `nullif(btrim(coalesce(current_setting(…, true), '')), '')` | `:52-55` | Yes, character-for-character the wrapper the § 4 table names, for both settings |
| Invocations — both, editor first, verbatim in the header (AC-13) | `:22-31` | Yes. Dashboard editor at `:25-27`, `psql`/`PGOPTIONS` at `:31`. The `psql` form is one line rather than the plan's two; the plan's line-continuation `\` would have produced a line beginning `\`, which AC-12 forbids, so the join is required rather than cosmetic |
| Resolution of the auth user, trimmed and lowercased on both sides (AC-2, AC-3) | `:115-118`, predicate at `:118` | Yes — `lower(btrim(u.email)) = lower(v_email_setting)`, and `v_email_setting` is already `btrim`ed at `:53`. Selects `u.id, u.email, u.raw_user_meta_data` into the three declared variables, as § 4's SQL block does |
| Count rather than assume; `> 1` raises naming the count | `:99-101`, `:108-113` | Yes. The count is taken with the same widened predicate, and `:110` interpolates `v_match_count` into the message. This is the payment § 4 names for widening ADR-030 decision point 5 |
| AC-2's message fixed verbatim | `:104` | Yes — `no auth user with that address; sign up through the application first`, identical to `01-plan.md` § 4 |
| The team: `0` insert, `1` reuse without renaming, `> 1` raise | count `:123`; `> 1` raise `:125-130`; insert `:174-177`; reuse `:178-181` | Yes. `insert into public.team (name) values (v_team_name) returning id into v_team_id` leaves `overload_threshold` and `created_at` to the column defaults (`…tea01_membership.sql:24-29`). The reuse branch selects the id and does not rename — AC-5 |
| The member row, precedence AC-7 → AC-8 → AC-9 → insert | `:133-136` fetch; AC-7 `:141-145`; AC-8 `:147-152`; AC-9 `:155-167`; insert `:186-195` | Yes, and in that order. `if found then` at `:138` correctly discriminates "a row exists for this uid" after `select … into`, so the AC-9 count at `:158-161` can only see other ids |
| AC-7 is the only silent outcome and holds whether or not other active admins exist | `:141-144` | Yes. `raise notice` then `return`, evaluated before the AC-9 count is ever taken |
| AC-8 never promotes and never un-removes | `:150-152` | Yes. The branch raises; there is no `update` statement anywhere in the file |
| `display_name` / `avatar` as a marked copy of `…tea01_membership.sql:115-117` | `:190-192`, marked at `:42-44` and `:191` | Yes. `coalesce(nullif(btrim(v_meta ->> 'display_name'), ''), split_part(v_email, '@', 1))` and `coalesce(nullif(btrim(v_meta ->> 'avatar'), ''), '🙂')` are expression-for-expression the trigger's, with `v_email` carrying `u.email` unaltered so the `split_part` fallback derives identically |
| `role = 'admin'`, `removed_at` null, `created_at` from the default | `:193`, and by omission from the column list at `:186` | Yes |
| `public.allowed_email` untouched — no row written, none consumed | whole file | Yes. `grep -nE 'insert into\|update \|delete from'` returns only `:175` and `:186`; `allowed_email` appears nowhere outside comments |
| Every `raise exception` carries `using hint =` naming the § 3 listing; AC-1's names both invocations | `:84`, `:90`, `:105`, `:112`, `:129`, `:152`, `:166`; `v_listing` `:57-60`; `v_invocations` `:61-67` | Yes. All seven exceptions carry a hint. The two AC-1 raises at `:84` and `:90` carry `v_invocations \|\| ' ' \|\| v_listing`; the rest carry `v_listing` |
| Return type: none — three observable outputs | whole file | Yes. No result set, no success notice invented |
| AC-11 — no credential, no auth user created | verified by grep | `encrypted_password`, `insert into auth`, `update auth.` — no match. Two email-shaped literals, `:25` and `:31`, both `admin-zero@example.com` inside the header comment, which is AC-11's own carve-out |
| AC-12 — no psql meta-command | verified by grep | `grep -n '^\\' supabase/bootstrap.sql` returns nothing |
| AC-13 — header states its own procedure, editor first | `:1`, `:3-7`, `:9-12`, `:14-20`, `:22-31`, `:33-35`, `:37-40`, `:42-44` | Yes, and all four required sentences are present: human-applied never by an agent (`:1`, mirroring `supabase/seed.sql:1`); no password and no auth user created (`:3-7`); the read-only listing performed before the first application (`:14-20`); the two derived columns a deliberate copy (`:42-44`) |

**The one ambiguity in § 4, and why it is not a finding.** `03-impl-log.md:63-73` discloses that AC-6
is evaluated before AC-7 (`supabase/bootstrap.sql:125` precedes `:141`) and that `01-plan.md` fixes
only *AC-7 before AC-9*, leaving AC-6 against AC-7 unstated. The corner is a project holding two or
more teams whose resolved uid is already an active admin: as built it raises AC-6's message rather
than emitting AC-7's notice. **No row is written on either reading**, so AC-10 holds both ways and the
1→2→3→4 precedence § 4 does fix is intact at `:141`, `:150`, `:158`, `:186`. The Developer resolved an
under-specification in the direction that refuses, which is the direction AC-6 exists to enforce, and
said so rather than leaving it to be diffed out. That is not a contract item unimplemented.

## R7 detail

**One row per ID in `invariants_touched`.**

| Invariant | Held by | Citation |
|---|---|---|
| INV-07 — *"Every entry belongs to exactly one member, and is counted only against the team that member belongs to"* (`.ai/registry/invariants.md:39`) | Two refusals and one assignment, none of them a UI affordance. **A second team row cannot be created here:** `:125-130` raises outright when `public.team` holds more than one row, and `:178-181` reuses the single existing row rather than inserting beside it — which `on conflict do nothing` could not have expressed, because `public.team` has no unique constraint on `name` (`…tea01_membership.sql:24-29`). A partitioned roster is the failure mode INV-07 guards against, and it is closed by a refusal rather than by care. **A member row with no team cannot be created:** `team_id` is taken from `v_team_id` at `:189`, which is assigned on both branches of `:174-181` and is null on neither, and `member.team_id` is `not null references public.team (id)` (`…tea01_membership.sql:32`) so the database would refuse it in any case. The comment at `:189` carries the same marker the trigger carries at `…tea01_membership.sql:114` — *"INV-07: the team comes from here and nowhere else"* — and this file is that same *nowhere else* for the one row the trigger cannot write | `supabase/bootstrap.sql:125-130`, `:174-181`, `:189`; `.ai/registry/invariants.md:39`, `:163-168` |

**INV-01 through INV-06 are untouched, and the reason is mechanical rather than asserted.** This file
writes no `entry` row and defines no count — `grep -nE 'insert into|update |delete from'` returns
`supabase/bootstrap.sql:175` and `:186` only, `public.team` and `public.member`. The six invariants
that quantify over entries, dates, thresholds and holidays have nothing in this file to be true or
false about.

## Findings

None.

## Verdict

`PASS`. `next_state: DONE`.

**Two things the orchestrator will meet at `/ship`, neither of which is a defect in the code under
review and neither of which is this stage's to fix.**

1. **`gates.plan` is still `{ passed: false, at: null }`** at `.ai/board/tickets/OPS-004/ticket.yaml:27`,
   and the ticket went `BACKLOG` → `REVIEW` without passing through READY or IN_PROGRESS.
   `01-plan.md` front-matter carries `gate: PASS` and `next_state: READY`, so the plan gate was
   reached and never recorded. Definition of Done item 1 requires both gates `passed: true` with
   timestamps (`.ai/01-operating-model.md:349`), so `/ship` will refuse until someone records it.
   Already raised at `03-impl-log.md:145-155`; repeated here because it now stands between a passing
   review and a shippable ticket.
2. **`scripts/check-allowed-paths.mjs` cannot grade this ticket yet.** It enumerates
   `git diff --name-only origin/main...HEAD` (`:128`), and ADR-006 leaves the whole ticket
   uncommitted until `/ship`, so its exit 0 today is vacuous. R1 above is graded on the working tree
   instead, which is the only surface that currently holds the change. The check grades it for real
   after `/ship` commits.
