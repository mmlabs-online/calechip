---
from: developer
to: tech-lead-design
asked_at: 2026-10-21T17:33:28+07:00
---

**Q.** AC-1 and AC-4 cannot pass as the repository stands, because one committed migration does not
apply to any fresh database. Which way does MIR-05 go?

**The fact.** `supabase/migrations/20260905120100_adm02_holiday_seed.sql:30-33` is
`insert into public.holiday (date, name, kind) values` followed only by comments and
`on conflict (date) do nothing;`. It is invalid SQL **on purpose** — its banner (lines 4-28) calls
this the fail-closed half of ADM-02's decision: no migration run may succeed until a human fills in
the Vietnamese public holidays from the government's announcement. ADM-02's review recorded it
(`ADM-02/04-review.md:168`). Every migration after it in filename order (35 files, adm03 onward)
therefore never applies on a disposable stack.

**Observed with the harness built to plan § 4** (`03-impl-log.md` § Verification run): `pnpm db:test`
reaches `start`, which applies migrations on a fresh volume, and stops at that file with
`ERROR: syntax error at or near "on" (SQLSTATE 42601)`, exit 1, no test reported. That is AC-3
behaving correctly against a real file — and it means AC-1 and AC-4 can never pass, locally or in
CI, and the `database` job would make `verify` red on every run.

**Probe, run in a scratch copy only** (no repository file was changed): with that single file
replaced by `select 1;`, all 45 migrations apply, `db reset --local` succeeds with the seed disabled,
and `000-harness.test.sql` passes 4/4. So this file is the only obstacle.

**Options as I see them. None is mine to choose: A is a human fact, B and C amend an AC or a
migration outside `allowed_paths`.**

- **A — the operator fills the holiday rows** (ADM-02 Open question 1, owed since 2026-09-05). No
  amendment to this plan; MIR-05 unblocks the moment the file parses. Also the only option that
  makes the hosted project's migration history whole.
- **B — the harness substitutes that one file, in a throwaway copy.** `scripts/db-test.mjs` copies
  `supabase/` to a temp directory, replaces `20260905120100_adm02_holiday_seed.sql` with a no-op
  **only while it is still unparseable**, and runs the three steps with `--workdir` pointed there.
  Needs AC-1 amended to name the exception, and § 4.2 to name the copy. Risk: a test DB with no
  holidays, and a second code path between local and the repository's real migration set.
- **C — make the migration valid with zero rows** (e.g. a `do` block that raises unless rows exist,
  or an empty `insert … select … where false`). Edits a shipped migration outside `allowed_paths`,
  changes ADM-02's fail-closed mechanism, and makes this ticket a schema-file change — out of scope
  under § 1.

My recommendation is **A**, with **B** as the fallback if the dates cannot be supplied soon: B is
self-contained and removable, C reaches into another ticket's decision.

**A.** Option A — decided by the operator, in words, 2026-10-21, in the developer session ("chọn A").
Recorded here by `developer`; `tech-lead-design` was not consulted, because the choice is a human
fact rather than a design call. The operator fills the rows of
`supabase/migrations/20260905120100_adm02_holiday_seed.sql` from the government's announcement
(ADM-02 Open question 1); no agent writes them. MIR-05 stays BLOCKED until that file parses, then
`/implement MIR-05` re-runs `pnpm db:test` unchanged.

**Amended:** none — the artifact was already correct. AC-1 stands as written.
