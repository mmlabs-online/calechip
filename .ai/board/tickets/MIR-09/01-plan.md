---
ticket: MIR-09
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-23T08:24:15Z
inputs_read:
  - .ai/board/tickets/MIR-09/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/standards/data-model.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/board/tickets/ADM-01/01-plan.md
  - supabase/migrations/
  - supabase/tests/
  - supabase/seed.sql
  - supabase/bootstrap.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/routes/Threshold.tsx
  - tests/threshold.test.ts
  - tests/draft-entry.test.ts
consulted:
  - with: developer
    asked: "Whether tests/draft-entry.test.ts may be added to allowed_paths and its AC-14 charter-refusal-6 scanner narrowed so that the new team_overload_threshold_range check constraint on public.team is not flagged as consulting the threshold to refuse a plan write."
    answer: "Approved. Added tests/draft-entry.test.ts to allowed_paths and specified the exact narrowing in § 4."
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-09 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md`:**

| ID | Feature | Group | Status |
|---|---|---|---|
| MIR-09 | Known schema inconsistencies are cleaned up: transaction wrapping, allow-list references, an index on `member.team_id`, a check on the overload threshold | MIR | PLANNED |

The source is plan item P2-2 (`.ai/board/plans/calechip-multi-tenancy-plan.md:147-151`):
- `issue.sql` has no `begin`/`commit`, unlike its neighbours.
- Remove references to the dropped `allowed_email` table.
- Add the missing index on `member.team_id`.
- Add a check constraint on `team.overload_threshold`, which is currently unconstrained.

**Who gains what.** This ticket has two beneficiaries:
- **Admins.** They lose nothing they can do today. Every path that writes the threshold now refuses
  a value outside 0–100%, not only the screen. Phase 3 adds org-admin writers, and those would
  otherwise bypass the one guard that exists.
- **Phase 3 planners.** They get a schema that holds no leftovers. The team-membership reads they
  are about to rewrite are indexed, and no error code still describes a table that was dropped on
  2026-09-10.

**What "allow-list references" means here.** It means code identifiers and statements that describe
`public.allowed_email`, or the allow-list it implemented, as if it still existed. Today these are:
- the `already_allow_listed` and `already_consumed` failure codes, and the `23505` mapping that
  produces the first of them;
- the two orphaned fixture doc comments at `src/lib/fixtures.ts:57` and `:59`, whose constants were
  deleted;
- the present-tense sentence at `supabase/bootstrap.sql:183-185`.

`db.sql`, where the audit found them (A:316-317), was deleted by MIR-08.

**Out of scope.**
- **`supabase/migrations/` other than the one file named.** Shipped migrations are the history.
  Their `allowed_email` statements are what ran.
- **The sixteen other migrations without `begin`/`commit`** (tea01 to adm06, profile_self_update,
  evt11). The audit's *"unlike its neighbours"* is true only locally. ADR-069 records why these are
  not rewritten.
- **The trigger function `admit_allow_listed_member`.** Renaming it is a migration plus a catalogue
  test change (`supabase/tests/010-catalogue.test.sql:59`), and its name is no longer a claim about
  a table.
- **Test IDs `admin-hub-allow-list-link` and `home-allow-list-link`.** These are selectors, and
  renaming them is a UI/e2e change.
- **Historical comments of the form "X stood here until the allow-list was removed".** They are
  accurate records and are kept. This includes `seed.sql`, `App.tsx`, `index.ts:62`, `mock.ts:143`
  and `tests/profile-writes.test.ts:32`.
- **`tests/e2e/tea-01-signup.spec.ts` constant names.** That is e2e work.
- **Whole-percent granularity.** The database checks the range only. ADM-01 AC-8's whole-percent
  rule stays a screen rule.
- **Found while reading, and not this ticket's:** `supabase/bootstrap.sql` inserts the first admin
  without `status`. The column default has been `'pending'` since `member_approval`, so a bootstrapped
  admin may be pending and therefore not `is_admin`. This needs its own ticket. Section 4 changes
  only the comment there.

**`size_estimate`: M.**

## 2. Acceptance criteria

**AC-1 — the index exists**
- Given a database built from every migration (`pnpm db:test`)
- When the catalogue is read
- Then `public.member` has an index named `member_team_id_idx` on exactly the column `team_id`

**AC-2 — the database refuses an out-of-range threshold**
- Given an approved admin of team T, authenticated as `authenticated`
- When they run `update public.team set overload_threshold = <v>` on T for `v` in `1.01`, `-0.01`,
  `2` and `'NaN'`
- Then each statement fails with SQLSTATE `23514`, and T's threshold is unchanged

**AC-3 — the bounds themselves are accepted**
- Given the same admin
- When they set T's threshold to `0`, then `1`, then `0.5`
- Then each update affects one row and stores that value

**AC-4 — the seam refuses before sending, mock and real alike**
- Given any caller, admin or not
- When `setOverloadThreshold` is called with `overloadThreshold` of `1.5`, `-0.1`, `NaN` or
  `Infinity`
- Then it returns `{ ok: false, error: { code: "invalid_threshold" } }`, no write reaches the
  datastore, and the stored value is unchanged
- And the value check precedes the permission check, so a non-admin also gets `invalid_threshold`

**AC-5 — a database refusal arriving at the seam carries the same code**
- Given the real seam
- When the `team` update for the threshold returns SQLSTATE `23514`
- Then `setOverloadThreshold` returns `invalid_threshold`, never `unknown`

**AC-6 — existing behaviour is unchanged**
- Given an admin
- When `setOverloadThreshold` is called with `0`, `0.6` or `1`
- Then every existing test in `tests/threshold.test.ts` still passes unchanged, and `pnpm db:test`
  passes, including the seed teams at `0.5`

**AC-7 — `issue.sql` is wrapped**
- Given `supabase/migrations/20260926100000_solo_issue_report.sql`
- When it is diffed against `origin/main`
- Then the only changes are a `begin;` line before its first statement and a `commit;` line after
  its last

**AC-8 — no live code names the dropped allow-list**
- Given `src/` and `supabase/bootstrap.sql`
- When they are searched for `already_allow_listed`, `already_consumed`, and the present-tense
  `public.allowed_email` sentence at `bootstrap.sql:183-185`
- Then there is no match, and `src/lib/fixtures.ts` has no doc comment without the declaration it
  documents
- And `pnpm typecheck`, `pnpm lint` and `pnpm test` pass

**AC-9 (refusal) — no other shipped migration changes**
- Given the branch
- When it is diffed against `origin/main`
- Then no file under `supabase/migrations/` changes except the two named in section 7

**Invariants touched:** `[]`.
- INV-04 defines the absence count. The threshold multiplies that count, but no value previously
  accepted by the screen is refused, so no day is classified differently.
- INV-07 reads `member.team_id`. An index does not change what any read returns.

**Open questions:** none. The range `[0, 1]` is taken from ADM-01 AC-7 and the
`SetOverloadThresholdInput` contract, not invented.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(No layout changes. `Threshold.tsx` already renders `result.error.message`, and the screen's own
AC-7 guard means a person never reaches the new code.)

## 3. Permission model

Unchanged. `team_update_admin` and `grant update (overload_threshold)` (adm01) still decide who may
write the threshold. The check constraint decides what value is acceptable, whoever writes it,
service role included. The check lives in the datastore (`team_overload_threshold_range`), and the
seam's pre-send refusal is an affordance only.

Denials are unchanged: a member, a manager, a pending member and a removed admin are refused by the
policy exactly as before. The value check now runs first, so they see `invalid_threshold` for an
out-of-range value and `not_permitted` for an in-range one.

## 4. Contract

**Migration** — `supabase/migrations/20261023120000_mir09_schema_cleanup.sql`. The header comment
cites MIR-09 and ADR-069 and says that applying it is human (RULE-09).

```sql
begin;

create index if not exists member_team_id_idx on public.member (team_id);

alter table public.team drop constraint if exists team_overload_threshold_range;
alter table public.team
  add constraint team_overload_threshold_range
  check (overload_threshold >= 0 and overload_threshold <= 1);

commit;
```

**`src/lib/domain/types.ts`** — `FailureCode`:
- remove `"already_allow_listed"` and `"already_consumed"`;
- add the following, with a comment citing MIR-09 / ADR-069:

```ts
  | "invalid_threshold" // MIR-09: overload_threshold outside [0, 1], or not finite (SQLSTATE 23514)
```

**`src/lib/data/mock.ts`** — in the `refused(...)` code union, remove `"already_allow_listed"` and
`"already_consumed"` and add `"invalid_threshold"`. Then add this as the first statement of
`setOverloadThreshold`:

```ts
if (!isValidThreshold(input.overloadThreshold)) {
  return refused("invalid_threshold", INVALID_THRESHOLD_MESSAGE);
}
```

**`src/lib/data/index.ts`** — exported beside `SetOverloadThresholdInput`. Both implementations
import these two names; there is no second copy.

```ts
/** MIR-09, ADR-069. The datastore's `team_overload_threshold_range`, restated for the pre-send guard. */
export function isValidThreshold(share: number): boolean {
  return Number.isFinite(share) && share >= 0 && share <= 1;
}
export const INVALID_THRESHOLD_MESSAGE = "The threshold must be between 0% and 100%.";
```

The doc comment on `setOverloadThreshold` that reads *"NO RANGE CHECK HERE … there is no `check`
constraint behind this"* is replaced. The new text states the pre-send guard, the constraint name,
and `invalid_threshold`.

**`src/lib/data/supabase.ts`**
- `setOverloadThreshold`: the first statement is the same `isValidThreshold` guard returning
  `{ ok: false, error: { code: "invalid_threshold", message: INVALID_THRESHOLD_MESSAGE } }`.
- In the same function, before the generic mapping:

  ```ts
  if (error) {
    if (error.code === "23514") {
      return { ok: false, error: { code: "invalid_threshold", message: INVALID_THRESHOLD_MESSAGE } };
    }
    return { ok: false, error: toPostgrestFailure(error) };
  }
  ```

- `toPostgrestFailure`: delete the `case "23505"` arm. None of its four callers (`removeMember`,
  `updateOwnProfile`, `setOverloadThreshold`, `setApprovalSettings`) writes a column with a unique
  constraint. A `23505` therefore falls to `unknown`.
- The CAL-01 comment at `:1334-1338` that cites "`42501` on `allowed_email`" is reworded to speak of
  `member` and `team`.
- The comment edits from MIR-08 at `:2304` stay as they are.

**`src/lib/fixtures.ts`** — delete the two orphaned doc comments at lines 57 and 59. Line 61
(`FIXTURE_UNLISTED_EMAIL`) and its comment stay, because they are in use.

**`supabase/bootstrap.sql:183-185`** — the sentence about `public.allowed_email` becomes a past-tense
note that the table was dropped by `20260910100000_solo_member_approval.sql`. No SQL statement
changes.

**`supabase/migrations/20260926100000_solo_issue_report.sql`** — add `begin;` before the first
statement and `commit;` after the last. Nothing else changes.

**`supabase/tests/110-schema-cleanup.test.sql`** — pgTAP, in the shape of `050-cross-team-writes`
(`begin; \ir _isolation.psql; select plan(n); select tests.seed(); … finish(); rollback;`):
- AC-1: `has_index('public', 'member', 'member_team_id_idx', array['team_id'])`.
- AC-2: `throws_ok(..., '23514')` for each of the four values, run as `admin_t` on `team_t`.
- AC-2 and AC-3: `results_eq` on the stored value.
- AC-3: `tests.rows_affected(...) = 1` for each bound.

**`tests/threshold.test.ts`** — a new `describe("MIR-09 range")`:
- AC-4 against the mock, as an admin and as `FIXTURE_MEMBER`;
- the stored value is unchanged afterwards.

**`tests/draft-entry.test.ts` (edit, AC-14 scanner only; added 2026-10-27).** CAL-07's AC-14 scanner
(`tests/draft-entry.test.ts:280-343`) pins Charter refusal 6 by scanning every migration for any
statement mentioning `overload_threshold` that matches `CAN_REFUSE_A_WRITE` (`policy`, `trigger`,
`before insert/update`, or `check (`). That regex flags `team_overload_threshold_range`, which
validates the admin's own input when writing `team.overload_threshold` (ADR-069) and does not
consult the threshold to refuse an entry or plan write. Narrow `mentioningThreshold` so it excludes
the column's own range constraint on `public.team`:

```ts
/** MIR-09, ADR-069: `team_overload_threshold_range` checks the column's own [0, 1] bounds on
 *  `public.team`; it does not consult the threshold to gate an entry or plan write (refusal 6). */
const IS_OWN_COLUMN_RANGE_CHECK =
  /^\s*alter\s+table\s+public\.team\s+add\s+constraint\s+team_overload_threshold_range\s+check\s*\(\s*overload_threshold\s*>=\s*0\s+and\s+overload_threshold\s*<=\s*1\s*\)\s*$/i;

const mentioningThreshold = (sql: string): string[] =>
  statementsOf(sql).filter(
    (statement) =>
      statement.includes("overload_threshold") && !IS_OWN_COLUMN_RANGE_CHECK.test(statement),
  );
```

Nothing else in `tests/draft-entry.test.ts` changes: `CAN_REFUSE_A_WRITE`, the per-migration test
loop and the positive control (`fires when a real migration's policy is made to consult the
threshold`) stay untouched and green.

## 5. Seam impact

No function is added, renamed or re-aritied, so `tests/seam-parity.test.ts` is unaffected.
`setOverloadThreshold` gains the same refusal in both implementations. `FailureCode` loses two
members and gains one. `isValidThreshold` and `INVALID_THRESHOLD_MESSAGE` are module exports of
`index.ts`, not seam methods.

## 6. Schema delta

There are three changes, all under
[ADR-069](../../../registry/decisions/ADR-069-member-team-id-is-indexed-and-the-overload-threshold-is-checked-in-the-database.md):
- index `member_team_id_idx`;
- check constraint `team_overload_threshold_range`, which is not `none` under ADR-014;
- `begin`/`commit` added to `20260926100000_solo_issue_report.sql`.

No policy, grant, function or trigger changes. Applying the migration is human (RULE-09). It fails
if the hosted project holds a threshold outside `[0, 1]`, and that is intended.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-069-member-team-id-is-indexed-and-the-overload-threshold-is-checked-in-the-database.md"
  - "supabase/migrations/20261023120000_mir09_schema_cleanup.sql"
  - "supabase/migrations/20260926100000_solo_issue_report.sql"
  - "supabase/tests/110-schema-cleanup.test.sql"
  - "supabase/bootstrap.sql"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/domain/types.ts"
  - "src/lib/fixtures.ts"
  - "tests/threshold.test.ts"
  - "tests/draft-entry.test.ts"
```

- The ADR path was added before the ADR was written. The ADR is complete at PLAN, and the Developer
  does not edit it.
- There are 12 paths (11 at initial PLAN; `tests/draft-entry.test.ts` added by the 2026-10-27
  amendment below), so `size` is M, which agrees with `size_estimate`.
- `glossary_owed` is `[]`. *Threshold* already has its row and is not touched.

## 8. Rejected alternatives

- **Keep the range in the screen only (ADM-01 § 6).** This avoids a schema change and a new error
  code. Rejected: phase 3 adds org-admin writers to `team`, and a guard that lives in one React
  component is not a guard for them (ADR-069).
- **Map `23514` inside `toPostgrestFailure`.** This is one line instead of three. Rejected: that
  mapper serves four callers, and a `23514` from `member` would come back labelled as a threshold
  error. That is the "one code, two sentences" failure that `types.ts` warns about three times.
- **Remove every "allow-list" word from the tree.** This is the literal reading of "references".
  Rejected: it would rename a live trigger function, which is a migration plus a catalogue test, and
  two e2e selectors. It would also rewrite accurate history comments. It roughly doubles the paths
  for no change in behaviour.
- **Add the constraint `not valid`.** This is safer to apply. Rejected because it would accept a bad
  row silently (ADR-069).

## Delegated decisions

none. ADR-069 is written under ADR-008 and supersedes no accepted ADR.

## Changelog

- `2026-10-23T08:24:15Z` — plan written. Raised by `tech-lead-design`. **The prescribed order was
  not kept:** the source tree was read before sections 1 and 2 were written, because the meaning of
  "allow-list references" could not be fixed without knowing which references exist. The scope
  definition in section 1 is therefore informed by the code, and section 8's third alternative is
  the reading that was narrowed away.
- `2026-10-27T08:28:30+07:00` — section 4 gains the `tests/draft-entry.test.ts` AC-14 scanner
  narrowing (`IS_OWN_COLUMN_RANGE_CHECK`), and section 7 and `ticket.yaml` `allowed_paths` add
  `tests/draft-entry.test.ts` (12 paths; `size` stays `M`). CAL-07's scanner matches any `check (`
  in a statement mentioning `overload_threshold` and therefore false-positived on
  `team_overload_threshold_range`, which validates the column's own `[0, 1]` bounds on `public.team`
  (ADR-069) rather than consulting the threshold to refuse a plan or entry write (Charter refusal 6).
  Raised by `developer` in `99-questions.md`. Amended by `tech-lead-design`.
