---
ticket: MIR-20
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-12T07:15:00Z
inputs_read:
  - .ai/board/tickets/MIR-20/01-plan.md
  - .ai/board/tickets/MIR-20/ticket.yaml
  - src/lib/data/system.ts
  - src/system/main.tsx
  - supabase/tests/190-system-admin.test.sql
  - supabase/tests/350-move-team-to-org.test.sql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/_isolation.psql
  - tests/e2e/mir-15-c-move-team.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-20 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261112180000_mir20_impersonation.sql` | created | the two closed log tables, the partial unique index, and the five definer functions | § 4.1 |
| `supabase/tests/390-impersonation.test.sql` | created | pgTAP for AC-8 to AC-18, plus a definer-flag check for AC-19 (89 assertions) | § 4.4, AC-8..AC-19 |
| `supabase/tests/010-catalogue.test.sql` | modified | the definer census gains the five MIR-20 functions | § 4.4, AC-19 |
| `src/lib/data/system.ts` | modified | four `SystemSeam` methods in both implementations, local types and messages, `signOut()` ends the session first | § 4.2 |
| `src/system/main.tsx` | modified | banner, roster, start form, per-org *Impersonate* button, expired notice, countdown | § 4.3 |
| `tests/e2e/mir-20-impersonation.spec.ts` | created | AC-1 to AC-7 against the mock build | § 4.4, AC-1..AC-7 |

The three board and registry paths in `allowed_paths` (ADR-100 and the two sibling `ticket.yaml`
files) were written at PLAN and are not touched here.

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 tables, index, RLS, revokes | `supabase/migrations/20261112180000_mir20_impersonation.sql` §§ 1 | as specified, verbatim |
| 4.1 five functions | same file §§ 2 to 6 | all `security definer set search_path = ''`, revoked from `public, anon`, granted to `authenticated` |
| 4.2 types, constants, messages | `src/lib/data/system.ts:282` onward | names as in the plan |
| 4.2 four seam methods, Supabase | `src/lib/data/system.ts:626-670` | |
| 4.2 four seam methods, mock | `src/lib/data/system.ts:1321-1385` | `mockRosters` keyed by team id, or the org id for a dedicated org |
| 4.2 `signOut()` ends the session | `src/lib/data/system.ts:458` (Supabase); the mock's `signOut` clears `mockImpersonation` | |
| 4.3 components and state | `src/system/main.tsx:1063` (banner), `:1105` (roster), `:1200` (form), `:1329` (`refreshSession`) | |
| 4.4 tests | the three test files above | |

## Deviations from the design

none, with two small implementation choices inside the design:

- The mock's `signOut()` sets `mockImpersonation = null` directly instead of calling its own
  `endImpersonation()`: the latter refuses `not_permitted` when the session is not at `aal2`, and a
  sign-out from the `verify` screen must still clear state. Same observable result (AC-7).
- `impersonated_roster()` reads the session row a second time (for `team_id`) after
  `impersonated_org_id()` returns non-null, and raises `42501` if that read finds nothing, still before
  any write. `impersonated_org_id()` returns only the org id (§ 4.1), so this is the only way to learn
  the team without widening its signature.

## Invariants

`invariants_touched: []`. The roster reads `member`, `membership` and `team` and never an entry,
absence count, approval or portion; every write is to the two new tables. INV-04 and INV-07 are not
touched.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 62 files, 1217 tests |
| `pnpm exec playwright test tests/e2e/mir-20-impersonation.spec.ts tests/e2e/mir-15-c-move-team.spec.ts` | 0 | 11 passed (the new 7, the panel's MIR-15-c 3, the seam guard) |
| `node scripts/check-allowed-paths.mjs` | 0 | 6 changed files, all in `allowed_paths` |

**Not run: the pgTAP suite (`pnpm db:test`).** No Docker daemon or Supabase stack exists in this
environment. Substitute checks, which are weaker and say so: the migration was applied twice (second run
idempotent, no error) to a scratch PostgreSQL 16 holding stub `auth`, `org`, `team`, `member`,
`membership`, `system_admin` and `is_system_admin()`, and the functions were called as `authenticated`
at `aal2`. Observed: start returns an id and stores the trimmed reason; `current_impersonation` returns
the row; the roster returns Org A's two current members (removed member absent, team names sorted,
`{}` for none); a second start raises the `IM001` message; end then makes `current_impersonation` empty
and the roster raise; blank reason `23514`, null reason `23502`, 29 minutes `22023`; one `start`, `end`
and `read_roster` action per session. The scratch database is dropped. **`390-impersonation.test.sql`
has never been executed** — its plan count (89) was counted by script, not run. A reviewer or CI should
treat the first `pnpm db:test` as the real verification, in particular AC-15 (`insert entry` as a
system admin expecting `42501`) and AC-18 (`move_team_to_org` of an empty team of Org public).

The unit and end-to-end commands were each run once for this ticket; the wider end-to-end suite was
not run (only the two panel specs).

## Testability contract

Every `data-testid` of § 4.3 exists in `src/system/main.tsx`:

| selector | Exists at |
|----------|-----------|
| `system-org-impersonate` | `src/system/main.tsx:1464` |
| `system-impersonate-form`, `-team`, `-reason`, `-minutes`, `-submit`, `-cancel`, `-error` | `StartImpersonationForm`, `:1200` onward |
| `system-impersonation-banner`, `-org`, `-left`, `-reason`, `-end` | `ImpersonationBanner`, `:1063` |
| `system-impersonation-expired` | `OrgManagement`, below the banner slot |
| `system-roster`, `-loading`, `-empty`, `-error`, `-retry`, `-row`, `-name`, `-rank`, `-status`, `-teams` | `ImpersonatedRoster`, `:1105` |

## Delegated decisions

none.

## Open questions

- Applying the migration to the hosted project is a person's step (RULE-09).
- `.ai/board/tickets/MIR-20/ticket.yaml` `state` is left for `/advance`.
