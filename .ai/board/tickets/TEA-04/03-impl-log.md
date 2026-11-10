---
ticket: TEA-04
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-01T11:38:11+07:00
inputs_read:
  - .ai/board/tickets/TEA-04/01-plan.md
  - .ai/board/tickets/TEA-04/ticket.yaml
  - .ai/registry/decisions/ADR-020-the-admin-write-path-on-member.md
  - .ai/registry/decisions/ADR-017-the-qa-gate-is-temporarily-waived.md
  - .ai/standards/testing-standards.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260901090000_tea02_allow_list_writes.sql
  - supabase/migrations/20260901093000_tea03_member_select_team.sql
  - supabase/seed.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/fixtures.ts
  - src/lib/domain/types.ts
  - src/routes/MemberList.tsx
  - src/routes/AllowList.tsx
  - tests/seam-parity.test.ts
  - eslint.config.js
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# TEA-04 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20260901120000_tea04_member_writes.sql` | created | The whole authorization change: the column-level grant, `member_update_admin`, `member_enforce_role_and_removal()` and its `BEFORE UPDATE` trigger. Under ADR-005 this file *is* the feature; everything above it is an affordance. | §4.2 (both), §6 points 1–4 |
| `supabase/seed.sql` | modified | Adds `FIXTURE_SECOND_ADMIN` — an auth user and a member row. Without a second admin on the first team, AC-13's *admin row carries remove and no promote* is unobservable, because the caller and the only admin row are the same row. | §6.1 |
| `src/lib/fixtures.ts` | modified | The matching `FIXTURE_SECOND_ADMIN` literal. The seed and this module must carry the same values or the shared-fixture rule buys nothing. | §6.1 |
| `src/lib/data/index.ts` | modified | Declares `removeMember` and `promoteMember` on `DataSeam`. No existing signature changed. | §4.2 |
| `src/lib/data/supabase.ts` | modified | The real implementation of both. Issues the `UPDATE`, maps `42501` to `not_permitted` through the existing `toPostgrestFailure`, and treats **zero rows returned as a refusal** rather than as success. | §4.2 |
| `src/lib/data/mock.ts` | modified | The mock implementation of both, reproducing the **policy and the trigger** and not the screen; adds `FIXTURE_SECOND_ADMIN` to the seeded roster; and copies each seeded row on the way in (see Deviations). | §4.2, §5 |
| `src/routes/MemberList.tsx` | modified | The two controls, the confirmation dialog and the failure sentence. `canRemove`/`canPromote` are AC-13 exactly, and every one of them is an affordance. | §4.3, §8 |

**Two files in `allowed_paths` were deliberately not created** — `tests/permission-model.test.ts` and
`tests/e2e/tea-04-member-admin.spec.ts`. They are the acceptance suite, which is QA's from the story
and explicitly not the Developer's; `01-plan.md` §8.1 already records that neither TEA-02 nor TEA-03
produced its equivalent, because ADR-017 waives entry into the QA stage and nobody is dispatched to
write them. `allowed_paths` permits a file, it does not commission one. The consequence is stated
plainly under *Open questions* below, because it is not a small one.

## Contract items

`01-plan.md` numbers its contract as section 4, in three parts.

| § item | Implemented at | Notes |
|--------|----------------|-------|
| §4.1 — no domain type and no `FailureCode` added | `src/lib/domain/types.ts` **untouched** | Held. Every refusal reachable from this interface is the policy or the trigger saying no, and that is `not_permitted`, which exists. The four trigger refusals carrying distinct reasons are unreachable through the controls §4.3 draws. |
| §4.2 — `removeMember(memberId)` on `DataSeam` | `src/lib/data/index.ts:139` | Takes no timestamp, by design. |
| §4.2 — `removeMember` real | `src/lib/data/supabase.ts:371` | `.update().eq().select()`; zero rows is `not_permitted`. |
| §4.2 — `removeMember` mock | `src/lib/data/mock.ts:307` | Reproduces `using`, then the self-removal and one-way clauses, then the clock. |
| §4.2 — `promoteMember(memberId)` on `DataSeam` | `src/lib/data/index.ts:148` | One-way. No `demoteMember` exists and adding one would be inventing a permission. |
| §4.2 — `promoteMember` real | `src/lib/data/supabase.ts:400` | Sets `role: "admin"` literally; the other direction has no parameter that could carry it. |
| §4.2 — `promoteMember` mock | `src/lib/data/mock.ts:345` | Including the one deliberate strictness, kept and re-stated at the call site. |
| §4.2 — no existing signature changes | all eight prior functions untouched | This is §7's sizing test, and it holds: no existing caller changed. |
| §4.3 — `canRemove` / `canPromote` | `src/routes/MemberList.tsx:173-175` | Verbatim from the design, `removedAt` deliberately absent from both. |
| §4.3 — `pending` / `busy` / `actionError` | `src/routes/MemberList.tsx:38-40` | Named `busy` per the design; one flag covers both writes, and only one write can be in flight. |
| §4.3 — promote calls the seam directly, no confirmation | `src/routes/MemberList.tsx:74-97` | |
| §4.3 — remove opens the confirmation first; the dialog **stays open** on a refusal | `src/routes/MemberList.tsx:101-121`, `:312` | The AllowList.tsx shape. |
| §4.3 — a throw renders a generic failure, not a refusal | `src/routes/MemberList.tsx:87`, `:117` | A transport error is not a refusal, and rendering it as one would send an admin to ask for a permission they already have. |
| §4.3 — the confirmation sentence | `src/routes/MemberList.tsx:318-321` | The design's wording, unchanged. |
| §6 point 1 — `grant update (role, removed_at)` | `supabase/.../tea04_member_writes.sql:29` | Column-level, never blanket. This is AC-7. |
| §6 point 2 — `member_update_admin` | `:42` | `using` admin-and-own-team; `with check` on `team_id` as the second lock. |
| §6 point 3 — `member_enforce_role_and_removal()` | `:59` | Five clauses, in the design's order, `security invoker`, `search_path = ''`. |
| §6 point 4 — the `BEFORE UPDATE` trigger | `:109` | |
| §6 point 4 (negative) — no `alter table`, no column, no `drop policy`, no insert/delete policy, no blanket grant | the migration contains none of them | Written into the file's header as a standing prohibition, not only observed once. |
| §6.1 — one seed row, a second admin | `supabase/seed.sql:247`, `src/lib/fixtures.ts:131` | Same literals in both. |

## Deviations from the design

Two, both declared.

**1. The mock's seeded roster holds copies of the fixtures, not the fixture objects.**
`src/lib/data/mock.ts:54-59`. The array was `[FIXTURE_ADMIN, FIXTURE_MEMBER, …]` — the exported
objects themselves. TEA-04 is the first ticket whose seam writes **mutate** a seeded row:
`removeMember` sets `removedAt` and `promoteMember` sets `role`. Holding the references would let one
mock write change what `FIXTURE_MEMBER` means for every other importer in the process, so a test that
ran after a removal would read a fixture that no longer says what `fixtures.ts` says it says. Spread
on the way in, and nothing else changed. The design does not address this because it is below the
level it works at; it is recorded here rather than left silent because it is a line a reviewer will
otherwise see move for no stated reason.

**2. The header sentence now branches on role.** `src/routes/MemberList.tsx:190-193`. TEA-03 shipped
*"Trang này chỉ để xem"* — this page is read-only — which was true and is now true for a member only.
An admin has two controls on it. Leaving a false sentence above two working buttons is worse than
changing it, and the change is one ternary. The design specifies no copy for this line either way.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-07` — one member, one team | `team_id` is not in the grant. `grant update (role, removed_at)` is the entire `update` privilege on this table, so a statement naming `team_id` is refused with `42501 permission denied for column` before any policy runs — for a member and for an admin alike, because nobody may write it. The privilege is *withheld* rather than *predicated*, which is the shape known weakness 6 says works exactly where the answer is "nobody". Two further locks sit behind it and neither is load-bearing today: `member_update_admin.using` scopes both actions to the caller's own team so no statement reaches another team's row at all (AC-11), and the `with check` on `team_id` already refuses a cross-team move if a later ticket ever grants that column. Nothing above the seam names `team_id` in a write: both new seam functions send exactly one column each. |
| `INV-04` — one definition of the absence count | **This ticket computes no count, and adds no arithmetic anywhere.** It moves the column the count is defined against, and the three ways it could have broken a number it never computes are each closed. *A caller-supplied or backdated `removed_at`* — the trigger overwrites it with `now()` unconditionally on the null→non-null transition, and there is no parameter on `removeMember` that could carry a timestamp, so the wire value is discarded in both directions (AC-3, ADR-013's revert condition). *A removal that deletes rather than soft-deletes* — no `delete` policy and no `delete` grant exists, `on delete restrict` refuses one anyway, and `removeMember` issues an `UPDATE`; the row and its `removed_at` survive, and `listMembers` still returns it carrying `removedAt` (AC-1, AC-2, untouched from TEA-03). *A `team_id` write moving a member's entries to another team's count* — INV-07 above. The trigger's one-way clause closes the fourth path the design did not have to list: a removal re-dated after the fact would move every past count silently, and it raises instead. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | the command named in `.ai/standards/testing-standards.md` |
| `pnpm exec eslint .` | 0 | same. RULE-02 clean: nothing outside `src/lib/data/` names the client, and no inline disable was added |
| `pnpm exec vitest run` | 0 | 1 file, 2 tests. `tests/seam-parity.test.ts` passes **unedited** with the two new functions — the point of leaving it out of `allowed_paths` |
| `git diff --name-only` subset of `allowed_paths` | yes | seven files, all listed. The `.ai/**` paths dirty in the tree are PLAN's and the steward's, and predate this run |

`pnpm exec playwright test` was **not** run. It is the end-to-end command and no TEA-04 suite exists
to run — see the note under *Files touched* and *Open questions*.

## Testability contract

Twelve selectors from TEA-03 keep their names and their meaning; six are new.

| selector | Exists at |
|----------|-----------|
| `app-root` | `src/App.tsx` (unchanged) |
| `seam-banner` | `src/App.tsx` (unchanged) |
| `member-list-loading` | `src/routes/MemberList.tsx:126` |
| `member-list-not-on-a-team` | `src/routes/MemberList.tsx:138` |
| `member-list-unavailable` | `src/routes/MemberList.tsx:153` |
| `member-list-table` | `src/routes/MemberList.tsx:218` |
| `member-list-row` | `src/routes/MemberList.tsx:235`, carrying `data-member-id` and `data-role` |
| `member-list-row-avatar` | `src/routes/MemberList.tsx:240` |
| `member-list-row-name` | `src/routes/MemberList.tsx:243` |
| `member-list-row-role` | `src/routes/MemberList.tsx:251` |
| `member-list-empty` | `src/routes/MemberList.tsx:212` |
| **`member-list-row-promote`** | `src/routes/MemberList.tsx:269` |
| **`member-list-row-remove`** | `src/routes/MemberList.tsx:282` |
| **`member-list-remove-confirm`** | `src/routes/MemberList.tsx:312` |
| **`member-list-remove-confirm-accept`** | `src/routes/MemberList.tsx:331` |
| **`member-list-remove-confirm-cancel`** | `src/routes/MemberList.tsx:342` |
| **`member-list-action-error`** | `src/routes/MemberList.tsx:202` (promotion, above the table) and `:324` (removal, inside the dialog) |

**`member-list-action-error` appears twice in the source and never twice on screen.** `pending` is
what decides: the above-table copy renders only when `pending` is null, the in-dialog copy only when
it is not. A single-element query is therefore safe. The design asked for one selector in two places
and this is the only way to give it one without two names.

## Open questions

**Ten of the fifteen criteria have no automated evidence, and they are the ten that are the feature.**
AC-2, AC-3, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11 and AC-12 are properties of the grant, the
policy and the trigger. `01-plan.md` §8.1 puts every one of them in `tests/permission-model.test.ts`,
which does not exist, has not existed since TEA-02 specified it, and will not be written under
ADR-017. The migration in this ticket has never been applied to a database — RULE-09 makes applying
it human — so no line of the SQL above has been executed even once. What is unverified here is
disproportionately the authorization model, which is exactly what ADR-017's own Consequences
section predicts and accepts.

Two consequences worth naming for the reviewer rather than leaving to be inferred:

- **The five-clause trigger is unexecuted PL/pgSQL.** A typo in it fails closed on first use rather
  than open, which is the good direction, but R6 is reading it as prose and so is this log.
- **ADR-017's revert condition 3** is *a database is provisioned and the four commands run*. This
  ticket does not provision one and does not claim to.

**`FIXTURE_MEMBER` is in `src/lib/fixtures.ts` and is not in `supabase/seed.sql`.** Found while
adding the second admin; not fixed, because `01-plan.md` §6.1 says the seed gains **one** row and
widening that is the design's call and not mine. It matters for this ticket specifically: AC-6 is
*a member may neither remove nor promote*, and the seed has no active member-role account on
`FIXTURE_TEAM` to hold a token as — `55555555-…` exists only in the fixture module. Whoever writes
`tests/permission-model.test.ts` will hit this before they write a line. The fix is one auth user and
one member row in the seed, matching the literal already in `fixtures.ts`.
