---
doc_version: 1
last_updated: 2026-10-08
governed_by: [RULE-06, RULE-10]
---

# Backlog

**An ordered list, not a scored one.** A human reorders rows; the orchestrator takes the top of
READY. There is deliberately no priority algorithm, no score column, and no estimate-derived ranking.

**This is a view.** `ticket.yaml` is authoritative. On disagreement the orchestrator repairs this
file and does not touch `ticket.yaml` to make the view right.

**Do not run a generic prioritisation tool over this file.** It will produce a scored, reordered
list, which is exactly what the first sentence says it must never be.

## READY

Tickets that have been through PLAN and passed the full Definition of Ready. **READY means
planned, sized, and safe to build** — the next stage for a row here is IN_PROGRESS, not PLAN.

| # | Ticket | Title | Size | Depends on |
|---|--------|-------|------|------------|

**`MIR-17-e` shipped on 2026-11-09, `state: DONE`.** `features.md` row `MIR-17` left `PLANNED`: its own PLAN split the rest of plan item P4-2 to a new slice, `MIR-17-f` (still `BACKLOG`), which now owns the shared row's note. Moved to `## ARCHIVE`.

**`MIR-17-e` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-09 from `04-review.md` second pass (`produced_at: 2026-11-09T22:50:54+07:00`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. The rework R5 finding is closed. `state` stays `REVIEW`; `/ship` sets `DONE`. There is no row for it in this table (see below).

**`MIR-17-e` was at `READY` in `ticket.yaml`, moved to `REVIEW`** — recorded at /advance on 2026-11-09 from `03-impl-log.md` rework pass gate PASS (`produced_at: 2026-11-09T15:48:10Z`, second `/implement` pass: the `Sidebar.tsx` row left `allowed_paths` by the re-plan, so nothing there needed a Developer edit). `rework_count` stays `0`, unchanged from the REVIEW routing. There is no row for it in this table (see below); nothing to move.

**`MIR-17-e` was at `REWORK` (routed to `tech-lead-design`), moved back to `READY`** — recorded at /advance on 2026-11-09 from the re-planned `01-plan.md` (`produced_at: 2026-11-09T15:44:48Z`, first written `2026-11-09T15:04:44Z`): `gate: PASS`, all six Definition of Ready items re-evaluated and passing. `src/components/Sidebar.tsx` is dropped from `allowed_paths` — the review found its § 4 row and AC-4's clause targeted `Sidebar.tsx:540`, which sits inside a JSX comment; adding the import there would be an unused-import lint error (R3 vs R5 conflict). `rework_count` stays `0` (RULE-08, upstream PLAN defect). There is no row for it in this table (see below); nothing to move.

**`MIR-17-e` was at `REVIEW` in `ticket.yaml`, routed to `REWORK`** — recorded at /advance on 2026-11-09 from `04-review.md` (`produced_at: 2026-11-09T22:17:39+07:00`): `gate: FAIL`, `verdict: FAIL`, `failed_checks: [R5]`, `invariant_violation: false`, `route_to: tech-lead-design`, `increments_rework: false`. **R5 impossible as specified**: § 4's `Sidebar.tsx` row and AC-4's "each imports `mayAdminister`" clause target `Sidebar.tsx:540`, inside a JSX comment; adding the import makes an unused-import lint error. The Developer left the file unchanged and narrowed AC-4 unilaterally — a change to an acceptance criterion, which belongs to tech-lead-design. Per RULE-08 this is an upstream (PLAN) defect: `rework_count` stays `0`. There is no row for it in this table (see below); nothing to move.

**`MIR-17-e` was at `READY` in `ticket.yaml`, moved to `REVIEW`** — recorded at /advance on 2026-11-09 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-09T15:14:09Z`). There is no row for it in this table (see below); nothing to move.

**`MIR-17-e` moved here at /advance on 2026-11-09**, from `01-plan.md` gate PASS (`produced_at: 2026-11-09T15:04:44Z`) with all six Definition of Ready items passing; `schema_delta: none` (confirmed at PLAN, client and one vitest). PLAN wrote a new ADR, [ADR-092](../registry/decisions/ADR-092-the-entry-and-event-affordances-ask-the-role-helpers-and-the-rest-of-p4-2-is-mir-17-f.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`), narrowing ADR-091 decision 3 and splitting the rest of plan item P4-2 to a new slice, `MIR-17-f` (BACKLOG) — the fifth successive split (ADR-088 through ADR-092). `MIR-17-e` had no row in `## BACKLOG`, so no row left that table.

**`MIR-17-d` shipped on 2026-11-09, `state: DONE`.** `features.md` row `MIR-17` left `PLANNED`: its own PLAN split the rest of plan item P4-2 to a new slice, `MIR-17-e` (still `BACKLOG`), which now owns the shared row's note. Moved to `## ARCHIVE`.

**`MIR-17-d` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-09 from `04-review.md` (`produced_at: 2026-11-09T21:06:00+07:00`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE`. There is no row for it in this table (see below).

**`MIR-17-d` was at `READY` in `ticket.yaml`, moved to `REVIEW`** — recorded at /advance on 2026-11-09 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-09T21:03:21+07:00`). There is no row for it in this table (see below); nothing to move.

**`MIR-17-d` moved here at /advance on 2026-11-09**, from `01-plan.md` gate PASS (`produced_at: 2026-11-09T13:56:42Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-091](../registry/decisions/ADR-091-the-applications-manager-is-whoever-manages-a-team-and-the-rest-of-p4-2-is-mir-17-e.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`), narrowing ADR-090 decision 2 — the rest of plan item P4-2 split to a new slice, `MIR-17-e` (BACKLOG), the fourth successive split (ADR-088, ADR-089, ADR-090, ADR-091). `MIR-17-d` had no row in `## BACKLOG`, so no row left that table.

**`MIR-17-c` shipped on 2026-11-09, `state: DONE`.** `features.md` row `MIR-17` left `PLANNED`: its own PLAN split the rest of plan item P4-2 to a new slice, `MIR-17-d` (still `BACKLOG`), which now owns the shared row's note. Moved to `## ARCHIVE`.

**`MIR-17-c` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-09 from `04-review.md` (`produced_at: 2026-11-09T13:44:16Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE`. There is no row for it in this table (see below).

**`MIR-17-c` was at `READY` in `ticket.yaml`, moved to `REVIEW`** — recorded at /advance on 2026-11-09 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-09T13:41:00Z`). There is no row for it in this table (see below); nothing to move.

**`MIR-17-c` moved here at /advance on 2026-11-09**, from `01-plan.md` gate PASS (`produced_at: 2026-11-09T13:34:27Z`) with all six Definition of Ready items passing; `schema_delta: none` (confirmed at PLAN — `list_entry_owners` already answers `may_decide_entry`, no new RPC needed). PLAN wrote a new ADR, [ADR-090](../registry/decisions/ADR-090-the-worklist-decides-per-row-from-list-entry-owners-and-the-rest-of-p4-2-is-mir-17-d.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`), narrowing MIR-17-c to the approval worklist and splitting the rest of plan item P4-2 to a new slice, `MIR-17-d` (BACKLOG) — the third successive split (ADR-088, ADR-089, ADR-090). `MIR-17-c` had no row in `## BACKLOG`, so no row left that table.

**`MIR-17-b` shipped on 2026-11-08, `state: DONE`.** `features.md` row `MIR-17` left `PLANNED`: its own PLAN split the rest of plan item P4-2 to a new slice, `MIR-17-c` (still `BACKLOG`), which now owns the shared row's note. Moved to `## ARCHIVE`.

**`MIR-17-b` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-08 from `04-review.md` (`produced_at: 2026-11-08T18:28:00+07:00`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE`. There is no row for it in this table (see below).

**`MIR-17-b` was at `READY` in `ticket.yaml`, moved to `REVIEW`** — recorded at /advance on 2026-11-08 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-08T18:25:00+08:00`). There is no row for it in this table (see below); nothing to move.

**`MIR-17-b` moved here at /advance on 2026-11-08**, from `01-plan.md` gate PASS (`produced_at: 2026-11-08T11:19:56Z`) with all six Definition of Ready items passing; `schema_delta: none` (confirmed at PLAN, client and one vitest). PLAN wrote a new ADR, [ADR-089](../registry/decisions/ADR-089-the-admin-screen-guards-go-through-the-role-helpers-first-and-the-rest-of-p4-2-is-mir-17-c.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`), splitting the remainder of plan item P4-2 to a new slice, `MIR-17-c` (BACKLOG) — the second successive split (ADR-088, ADR-089). `MIR-17-b` had no row in `## BACKLOG`, so no row left that table.

**`MIR-17` shipped on 2026-11-08, `state: DONE`.** `features.md` row `MIR-17` left `PLANNED`: its own PLAN split the rest of plan item P4-2 to a new slice, `MIR-17-b` (still `BACKLOG`), which now owns the shared row's note. Moved to `## ARCHIVE`.

**`MIR-17` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-08 from `04-review.md` (`produced_at: 2026-11-08T07:36:34Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE`. There is no row for it in this table (see below).

**`MIR-17` was at `READY` in `ticket.yaml`, moved to `REVIEW`** — recorded at /advance on 2026-11-08 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-08T07:33:41Z`). There is no row for it in this table (see below); nothing to move.

**`MIR-17` moved here at /advance on 2026-11-08**, from `01-plan.md` gate PASS (`produced_at: 2026-11-08T07:12:01Z`) with all six Definition of Ready items passing; `schema_delta: none` (confirmed at PLAN, client/mock/test only). PLAN wrote a new ADR, [ADR-088](../registry/decisions/ADR-088-issue-reports-leave-the-member-app-first-and-the-rest-of-p4-2-is-mir-17-b.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`), splitting the remainder of plan item P4-2 to a new slice, `MIR-17-b` (BACKLOG); the full P4-2 touches ~26 `src` files (L). `MIR-17` had no row in `## BACKLOG`, so no row left that table.

**`MIR-16-h` shipped on 2026-11-08, `state: DONE`.** This is the last of MIR-16's eight slices (MIR-16, -b, -c, -d, -e, -f, -g, -h); `features.md` row `MIR-16` is set to `DONE`, Invariants `INV-02, INV-03` (from MIR-16-b, the only slice of the chain with a non-empty `invariants_touched`). Moved to `## ARCHIVE`. **Reviewer-disclosed side effect, for a human:** the local dev Postgres now carries migration `20261108200000` applied outside `supabase_migrations.schema_migrations` (an autocommit probe during review); the file is idempotent, so `supabase migration up` or `supabase db reset` restores a clean, correct state. Nothing in the repository, registry or any hosted project was touched.

**`MIR-16-h` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-08 from `04-review.md` (`produced_at: 2026-11-08T06:45:10Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE`. There is no row for it in this table (see below).

**`MIR-16-h` was at `READY` in `ticket.yaml`, moved to `REVIEW`** — recorded at /advance on 2026-11-08 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-08T06:37:56Z`). There is no row for it in this table (see below); nothing to move.

**`MIR-16-h` moved here at /advance on 2026-11-08**, from `01-plan.md` gate PASS (`produced_at: 2026-11-08T06:29:59Z`) with all six Definition of Ready items passing; `schema_delta` cites ADR-086 decision 2 and ADR-087 decision 2 (both already `ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`), and this PLAN wrote no further-splitting ADR. `MIR-16-h` had no row in `## BACKLOG`, so no row left that table.

**`MIR-16-g` shipped on 2026-11-08, `state: DONE`.** `features.md` row `MIR-16` left `PLANNED`: its own PLAN split the type change to a new slice, `MIR-16-h` (still `BACKLOG`), which now owns the shared row's note. Moved to `## ARCHIVE`.

**`MIR-16-g` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-08 from `04-review.md` (`produced_at: 2026-11-08T06:19:51Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE`. There is no row for it in this table (see below).

**`MIR-16-g` was at `READY` in `ticket.yaml`, moved to `REVIEW`** — recorded at /advance on 2026-11-08 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-08T06:16:39Z`). There is no row for it in this table (see below); nothing to move.

**`MIR-16-g` moved here at /advance on 2026-11-08**, from `01-plan.md` gate PASS (`produced_at: 2026-11-08T06:11:06Z`) with all six Definition of Ready items passing; `schema_delta: none` (confirmed at PLAN, pgTAP harness and fixtures only). `schema_delta` cites [ADR-087](../registry/decisions/ADR-087-the-fixtures-stop-deriving-a-team-role-from-member-role-before-manager-is-removed.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`), narrowing ADR-086 decision 2 — the type change split to a new slice, `MIR-16-h` (BACKLOG). `MIR-16-g` had no row in `## BACKLOG`, so no row left that table.

**`MIR-16-f` shipped on 2026-11-08, `state: DONE`.** `features.md` row `MIR-16` left `PLANNED`: its own PLAN split the removal of `'manager'` from the type to a new slice, `MIR-16-g` (still `BACKLOG`), which now owns the shared row's note. Moved to `## ARCHIVE`.

**`MIR-16-f` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-08 from `04-review.md` second pass (`produced_at: 2026-11-08T01:41:03Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. The rework-1 R5 finding is closed. `state` stays `REVIEW`; `/ship` sets `DONE`. There is no row for it in this table (see below).

**`MIR-16-f` was at `REWORK` (routed to `developer`), moved back to `REVIEW`** — recorded at /advance on 2026-11-08 from `03-impl-log.md` rework pass gate PASS (`produced_at: 2026-11-08T08:40:00Z`, fixed the AC-6 regex in `320-set-member-role-team-role.test.sql`). `rework_count` stays `1`, unchanged from the REVIEW routing. There is no row for it in this table (see below); nothing to move.

**`MIR-16-f` was at `REVIEW` in `ticket.yaml`, routed to `REWORK`** — recorded at /advance on 2026-11-08 from `04-review.md` (`produced_at: 2026-11-08T01:32:15Z`): `gate: FAIL`, `verdict: FAIL`, `failed_checks: [R5]`, `invariant_violation: false`, `route_to: developer`, `increments_rework: true`. **§ 4.2 AC-6's assertion doesn't see the pre-ticket body's exact shape** — `supabase/tests/320-set-member-role-team-role.test.sql:161` only matches a quoted literal after `set role =`, missing `set role = p_role`, so it would have passed against the function this ticket replaces. `rework_count` incremented to `1` (RULE-06: `1 < 2`, not escalated). There is no row for it in this table (see below); nothing to move.

**`MIR-16-f` was at `READY` in `ticket.yaml`, moved to `REVIEW`** — recorded at /advance on 2026-11-08 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-08T01:28:26Z`). There is no row for it in this table (see below); nothing to move.

**`MIR-16-f` moved here at /advance on 2026-11-08**, from `01-plan.md` gate PASS (`produced_at: 2026-11-08T01:15:47Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-086](../registry/decisions/ADR-086-set-member-role-writes-the-team-role-and-the-manager-value-is-removed-by-a-column-retype.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`), narrowing ADR-085 decision 2 — the removal of `'manager'` from `public.member_role` split to a new slice, `MIR-16-g` (BACKLOG). `MIR-16-f` had no row in `## BACKLOG`, so no row left that table.

**`MIR-16-c` shipped on 2026-11-08, `state: DONE`.** `features.md` row `MIR-16` left `PLANNED`: its own PLAN split the write side and the enum removal to a new slice, `MIR-16-f` (still `BACKLOG`), which now owns the shared row's note. Moved to `## ARCHIVE`.

**`MIR-16-c` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-08 from `04-review.md` (`produced_at: 2026-11-08T08:04:25+07:00`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE`. There is no row for it in this table (see below).

**`MIR-16-c` was at `READY` in `ticket.yaml`, moved to `REVIEW`** — recorded at /advance on 2026-11-08 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-08T08:01:00+07:00`). There is no row for it in this table (see below); nothing to move.

**`MIR-16-c` moved here at /advance on 2026-11-08**, from `01-plan.md` gate PASS (`produced_at: 2026-11-08T00:48:43Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-085](../registry/decisions/ADR-085-the-manager-rank-is-read-from-membership-first-and-the-value-leaves-member-role-second.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`), narrowing ADR-082 decision 1 — the write side and the enum removal split to a new slice, `MIR-16-f` (BACKLOG). `MIR-16-c` had no row in `## BACKLOG`, so no row left that table. This is the last of `MIR-16`'s three slices named at its own PLAN, but `MIR-16-f` keeps the shared `features.md` row `PLANNED`.

**`MIR-16-e` shipped on 2026-11-07, `state: DONE`.** `features.md` row `MIR-16` left `PLANNED`: it shares the row with `MIR-16-c`, still `BACKLOG` (ticket header comment). Moved to `## ARCHIVE`.

**`MIR-16-e` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-07 from `04-review.md` (`produced_at: 2026-11-07T13:49:07Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE`. There is no row for it in this table (see below).

**`MIR-16-e` was at `READY` in `ticket.yaml`, moved to `REVIEW`** — recorded at /advance on 2026-11-07 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-07T13:41:32Z`). There is no row for it in this table (see below); nothing to move.

**`MIR-16-e` moved here at /advance on 2026-11-07**, from `01-plan.md` gate PASS (`produced_at: 2026-11-07T13:32:50Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-084](../registry/decisions/ADR-084-the-fixtures-name-the-admin-role-through-one-helper-before-the-value-is-renamed-in-place.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`), decision 2 — the in-place rename of `'admin'` to `'org_admin'`. `MIR-16-e` had no row in `## BACKLOG`, so no row left that table.

**Empty again — `MIR-16-d` left this section for `## ARCHIVE` at its own ship on 2026-11-07.** Its sibling slices `MIR-16-c` and `MIR-16-e` stay at `BACKLOG`; the shared `MIR-16` row in `features.md` stays `PLANNED` until the last of them ships.

**`MIR-16-d` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-07 from `04-review.md` (`produced_at: 2026-11-07T13:24:00Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-16-d` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — `03-impl-log.md` gate PASS (`produced_at: 2026-11-07T13:12:40Z`); `/implement` had already set `state: REVIEW`, so /advance on 2026-11-07 found it already recorded. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-16-d` moved here at /advance on 2026-11-07**, from `01-plan.md` gate PASS (`produced_at: 2026-11-07T12:41:59Z`) with all six Definition of Ready items passing; `schema_delta: none` (test code only), with [ADR-084](../registry/decisions/ADR-084-the-fixtures-name-the-admin-role-through-one-helper-before-the-value-is-renamed-in-place.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`) recording the split. MIR-16-d had no row in `## BACKLOG`, so no row left that table. PLAN split the in-place rename to a new slice `MIR-16-e` (BACKLOG) — the third successive split of the role work (ADR-082, ADR-083, ADR-084).

**Empty again — `MIR-16-b` left this section for `## ARCHIVE` at its own ship on 2026-11-07.** Its sibling slices `MIR-16-c` and `MIR-16-d` stay at `BACKLOG`; the shared `MIR-16` row in `features.md` stays `PLANNED` until the last of them ships.

**`MIR-16-b` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-07 from `04-review.md` (`produced_at: 2026-11-07T19:28:09+07:00`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. Transcribed as written; the artifact is 19 lines with no R1–R8 table or citations, on a ticket that touches INV-02 and INV-03. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-16-b` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-11-07 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-07T12:03:07Z`). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-16-b` moved here at /advance on 2026-11-07**, from `01-plan.md` gate PASS (`produced_at: 2026-11-07T09:06:54Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-083](../registry/decisions/ADR-083-is-org-admin-replaces-is-admin-before-the-admin-value-is-renamed.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`), which narrows ADR-082. MIR-16-b had no row in `## BACKLOG`, so no row left that table. PLAN split the `admin` → `org_admin` rename to a new slice `MIR-16-d` (BACKLOG).

**Empty again — `MIR-16` left this section for `## ARCHIVE` at its own ship on 2026-11-07.** Its slices `MIR-16-b` and `MIR-16-c` stay at `BACKLOG` (ADR-082); the shared `MIR-16` row in `features.md` stays `PLANNED` until the last of them ships.

**`MIR-16` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-07 from `04-review.md` second pass (`produced_at: 2026-11-07T08:48:00Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. Both first-pass R5 findings are closed. `state` stays `REVIEW`; `/ship` sets `DONE`. There is no row for it in this table (see below).

**`MIR-16` was at `READY` in `ticket.yaml`, moved to `REVIEW`** — recorded at /advance on 2026-11-07 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-07T08:46:00Z`, a rework pass: fixed the `270` fixture-ordering bug and read `04-review.md`'s re-planned § 4.2/§ 4.3). There is no row for it in this table (see below); nothing to move.

**`MIR-16` was at `REWORK` (routed to `tech-lead-design`), moved back to `READY`** — recorded at /advance on 2026-11-07 from the re-planned `01-plan.md` (`produced_at: 2026-11-07T08:42:01Z`, first written `2026-11-07T08:17:01Z`): `gate: PASS`, all six Definition of Ready items re-evaluated and passing. `060-removed-and-pending.test.sql` is now in `allowed_paths` (fixing R5 finding 1); `MIR-20`'s `ticket.yaml` left it. `rework_count` stays `0`, unchanged from the REVIEW routing. There is no row for it in this table (see below); nothing to move.

**`MIR-16` was at `REVIEW` in `ticket.yaml`, routed to `REWORK`** — recorded at /advance on 2026-11-07 from `04-review.md` (`produced_at: 2026-11-07T08:38:00Z`): `gate: FAIL`, `verdict: FAIL`, `failed_checks: [R5]`, `invariant_violation: false`, `route_to: tech-lead-design`, `increments_rework: false`. **R5 finding 1 is impossible as specified** — dropping `issue_report_select_admin` breaks `supabase/tests/060-removed-and-pending.test.sql:72-74`, and `01-plan.md` § 7 keeps `060` out of `allowed_paths`, so the Developer could not have fixed it (RULE-03). Per RULE-08 this is an upstream (PLAN) defect: `rework_count` stays `0`. Finding 2 (a developer-caused ordering bug in `270`'s fixture) rides along to the re-plan. There is no row for it in this table (see below); nothing to move.

**`MIR-16` was at `READY` in `ticket.yaml`, moved to `REVIEW`** — recorded at /advance on 2026-11-07 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-07T08:34:50Z`). There is no row for it in this table (see below); nothing to move.

**`MIR-16` moved here at /advance on 2026-11-07**, from `01-plan.md` gate PASS (`produced_at: 2026-11-07T08:17:01Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-082](../registry/decisions/ADR-082-the-role-split-goes-in-three-slices-and-issue-reports-go-to-the-system-panel-first.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`), the first of three slices of the role split. PLAN split the remainder into `MIR-16-b` and `MIR-16-c` (both `BACKLOG`) and updated `MIR-17`'s and `MIR-20`'s `depends_on`; all four paths are in `MIR-16`'s own `allowed_paths`. `MIR-16` had no row in `## BACKLOG`, so no row left that table.

**Empty again — `MIR-21-f` left this section for `## ARCHIVE` at its own ship on 2026-11-07.** With it, all six slices of feature `MIR-21` (MIR-21, -b, -c, -d, -e, -f) have shipped, and its `features.md` row is set to `DONE`. `MIR-16`, `MIR-17` and `MIR-19` are unblocked once this merges.

**`MIR-21-f` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-07 from `04-review.md` (`produced_at: 2026-11-07T15:05:00+07:00`, as written — later than the time it was first seen): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. Transcribed as written; the artifact has no R1–R8 table or citations, flagged to the operator, who chose to advance. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-21-f` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — `03-impl-log.md` gate PASS (`produced_at: 2026-11-07T07:44:30Z`); `/implement` had already set `state: REVIEW`, so /advance on 2026-11-07 found it already recorded. One consultation (`99-questions.md`) added `supabase/tests/070-definer-callers.test.sql` to `allowed_paths` (12 paths, size M). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-21-f` moved here at /advance on 2026-11-07**, from `01-plan.md` gate PASS (`produced_at: 2026-11-07T07:30:13Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-080](../registry/decisions/ADR-080-the-team-lock-moves-to-membership-first-and-the-drop-splits-into-four-slices.md) decision 4 (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`). MIR-21-f had no row in `## BACKLOG`, so no row left that table. `allowed_paths` includes two standards-plane files, `.ai/standards/data-model.md` and `.ai/standards/rbac-and-security.md` — flagged to the operator before /advance.

**Empty again — `MIR-21-e` left this section for `## ARCHIVE` at its own ship on 2026-11-07.** Its drop slice `MIR-21-f` stays at `BACKLOG`; the shared `MIR-21` row in `features.md` stays `PLANNED` until MIR-21-f ships.

**`MIR-21-e` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-07 from `04-review.md` (`produced_at: 2026-11-07T13:28:45Z`, as written — later than the time it was recorded): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. Transcribed as written; the artifact's body is one line with no R1–R8 table or citations, flagged to the operator, who chose to advance. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-21-e` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-11-07 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-07T05:20:58Z`). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-21-e` moved here at /advance on 2026-11-07**, from `01-plan.md` gate PASS (`produced_at: 2026-11-07T05:10:56Z`) with all six Definition of Ready items passing; `schema_delta: none` (confirmed at PLAN, fixtures and seed scripts only). This PLAN wrote a new ADR, [ADR-081](../registry/decisions/ADR-081-the-fixtures-of-100-160-and-240-move-to-the-drop.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`), re-allocating three fixture files of ADR-080 decision 3 to `MIR-21-f`; both the new ADR file and `MIR-21-f`'s `ticket.yaml` are in `MIR-21-e`'s own `allowed_paths`. `MIR-21-e` had no row in `## BACKLOG`, so no row left that table.

**`MIR-21-d` shipped on 2026-11-07, `state: DONE`.** `features.md` row `MIR-21` left `PLANNED`: it shares the row with `MIR-21-e` and `MIR-21-f`, both still to come (ticket header comment). Moved to `## ARCHIVE`.

**`MIR-21-d` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-07 from `04-review.md` (`produced_at: 2026-11-07T04:31:21Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE`. There is no row for it in this table (see below).

**`MIR-21-d` was at `READY` in `ticket.yaml`, moved to `REVIEW`** — recorded at /advance on 2026-11-07 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-07T04:27:15Z`). There is no row for it in this table (see below); nothing to move.

**`MIR-21-d` moved here at /advance on 2026-11-07**, from `01-plan.md` gate PASS (`produced_at: 2026-11-07T04:15:39Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-080](../registry/decisions/ADR-080-the-team-lock-moves-to-membership-first-and-the-drop-splits-into-four-slices.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`), decision 2. `MIR-21-d` had no row in `## BACKLOG`, so no row left that table.

**`MIR-15-e` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-06 from `04-review.md` (`produced_at: 2026-11-06T09:39:00Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE`. There is no row for it in this table (see below).

**`MIR-15-e` was at `READY` in `ticket.yaml`, moved to `REVIEW`** — recorded at /advance on 2026-11-06 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-06T16:36:32Z`). There is no row for it in this table (see below); nothing to move.

**`MIR-15-e` moved here at /advance on 2026-11-06**, from `01-plan.md` gate PASS (`produced_at: 2026-11-06T09:08:21Z`) with all six Definition of Ready items passing; `schema_delta: none` (confirmed at PLAN, no migration). `MIR-15-e` had no row in `## BACKLOG`, so no row left that table.

**Empty again — `MIR-15-b` left this section for `## ARCHIVE` at its own ship on 2026-11-06.** Its sibling slices `MIR-15-c` and `MIR-15-d` stay at `BACKLOG`; `MIR-15-e` moved to `READY` the same day; the shared `MIR-15` row in `features.md` stays `PLANNED` until the last of them ships.

**`MIR-15-b` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-06 from `04-review.md` (`produced_at: 2026-11-06T08:32:49Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-15-b` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-11-06 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-06T08:17:06Z`). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-15-b` moved here at /advance on 2026-11-06**, from `01-plan.md` gate PASS (`produced_at: 2026-11-06T04:36:00Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-079](../registry/decisions/ADR-079-org-public-holidays-are-written-through-four-system-admin-rpcs-and-each-org-reads-only-its-own.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`). MIR-15-b had no row in `## BACKLOG`, so no row left that table. PLAN split the member-app half to a new slice `MIR-15-e` (BACKLOG). **Number collision, unresolved.** Open PR #194 (MIR-21-c) also carries an `ADR-079`, the migration version `20261106120000` and a `supabase/tests/240-*` file; whichever merges second must renumber. **Resolved 2026-11-07:** #195 merged first, so PR #194 renumbered MIR-21-c to ADR-080, migration `20261106130000` and test `250-membership-self-lock`.

**Empty again — `MIR-21-c` left this section for `## ARCHIVE` at its own ship on 2026-11-06.** Its slices `MIR-21-d`, `MIR-21-e` and `MIR-21-f` stay at `BACKLOG`; the shared `MIR-21` row in `features.md` stays `PLANNED` until MIR-21-f ships.

**`MIR-21-c` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-06 from `04-review.md` (`produced_at: 2026-11-06T11:17:12+07:00`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-21-c` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-11-06 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-06T10:21:35+07:00`); `/implement` had already set `state: REVIEW`. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-21-c` moved here at /advance on 2026-11-06**, from `01-plan.md` gate PASS (`produced_at: 2026-11-06T02:37:30Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-080](../registry/decisions/ADR-080-the-team-lock-moves-to-membership-first-and-the-drop-splits-into-four-slices.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`). PLAN split the drop into `MIR-21-d`, `MIR-21-e` and `MIR-21-f` (BACKLOG). MIR-21-c had no row in `## BACKLOG`, so no row left that table. **Resolved 2026-11-07:** #195 merged first, so PR #194 renumbered MIR-21-c to ADR-080, migration `20261106130000` and test `250-membership-self-lock`.

**Empty again — `MIR-21-b` left this section for `## ARCHIVE` at its own ship on 2026-11-05.** Its drop slice `MIR-21-c` stays at `BACKLOG`; the shared `MIR-21` row in `features.md` stays `PLANNED` until MIR-21-c ships.

**`MIR-21-b` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-05 from `04-review.md` (`produced_at: 2026-11-05T22:48:15+07:00`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-21-b` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-11-05 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-05T21:33:00+07:00`). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-21-b` moved here at /advance on 2026-11-05**, from `01-plan.md` gate PASS (`produced_at: 2026-11-05T13:24:22Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-078](../registry/decisions/ADR-078-writers-write-membership-alongside-the-column-and-the-drop-moves-to-mir-21-c.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`). PLAN moved the drop of `member.team_id` to a new slice `MIR-21-c` (BACKLOG). MIR-21-b had no row in `## BACKLOG`, so no row left that table.
**Empty again — `MIR-21` left this section for `## ARCHIVE` at its own ship on 2026-11-05.** Its writer-and-drop slice `MIR-21-b` stays at `BACKLOG`; the shared `MIR-21` row in `features.md` stays `PLANNED` until MIR-21-b ships.

**`MIR-21` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-05 from `04-review.md` (`produced_at: 2026-11-05T10:21:06Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `03-impl-log.md` gate PASS (`produced_at: 2026-11-05T10:15:00Z`) had already moved `state` to `REVIEW`. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-21` moved here at /advance on 2026-11-05**, from `01-plan.md` gate PASS (`produced_at: 2026-11-05T09:32:02Z`) with all six Definition of Ready items passing; `schema_delta` cites ADR-077 (renumbered from ADR-076, below) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`). MIR-21 had no row in `## BACKLOG`, so no row left that table. Writers and the drop split to `MIR-21-b`, at `BACKLOG`. **Number collision, resolved.** PR #191 (MIR-15) also carried an `ADR-076` and a `supabase/tests/210-*` file. On the operator's choice (option 1, 2026-11-05), `tech-lead-design` amended PLAN to renumber MIR-21's ADR to [ADR-077](../registry/decisions/ADR-077-a-members-roster-team-is-read-from-membership-and-mir-21-splits-reads-first.md) and its test to `220-roster-team-from-membership.test.sql`.

**Empty again — `MIR-15` left this section for `## ARCHIVE` at its own ship on 2026-11-05.** Its slices `MIR-15-b`, `MIR-15-c` and `MIR-15-d` stay at `BACKLOG`; the shared `MIR-15` row in `features.md` stays `PLANNED` until the last of them ships.

**`MIR-15` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-05 from `04-review.md` (`produced_at: 2026-11-05T13:59:00+07:00`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-15` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-11-05 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-05T06:45:13Z`); `/implement` had already set `state: REVIEW`. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-15` moved here at /advance on 2026-11-05**, from `01-plan.md` gate PASS (`produced_at: 2026-11-05T05:19:00Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-076](../registry/decisions/ADR-076-in-org-public-a-public-event-is-a-team-event-and-the-directory-reaches-no-other-team-through-it.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`). MIR-15 had no row in `## BACKLOG`, so no row left that table. The rest of the feature split to `MIR-15-b`, `MIR-15-c` and `MIR-15-d` (ADR-076 decision 6), all at `BACKLOG`.

**Empty again — `MIR-18-b` left this section for `## ARCHIVE` at its own ship on 2026-11-05.** The hardening slice `MIR-18-c` stays at `BACKLOG`; the shared `MIR-18` row in `features.md` stays `PLANNED` until MIR-18-c ships.

**`MIR-18-b` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-05 from `04-review.md` (`produced_at: 2026-11-05T05:04:30Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-18-b` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-11-05 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-05T02:27:01Z`). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-18-b` moved here at /advance on 2026-11-05**, from `01-plan.md` gate PASS (`produced_at: 2026-11-05T01:36:00Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-075](../registry/decisions/ADR-075-a-system-admin-manages-orgs-through-three-aal2-gated-rpcs.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`). MIR-18-b had no row in `## BACKLOG`, so no row left that table. The hardening split to `MIR-18-c`, which is at `BACKLOG`.

**Empty again — `MIR-18` left this section for `## ARCHIVE` at its own ship on 2026-11-05.** Its second slice `MIR-18-b` stays at `BACKLOG`; the shared `MIR-18` row in `features.md` stays `PLANNED` until MIR-18-b ships.

**`MIR-18` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-05 from `04-review.md` (`produced_at: 2026-11-05T01:02:31Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-18` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-11-05 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-04T08:33:48Z`). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-18` moved here at /advance on 2026-11-04**, from `01-plan.md` gate PASS (`produced_at: 2026-11-04T07:01:10Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-074](../registry/decisions/ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`). MIR-18 had no row in `## BACKLOG`, so no row left that table. The rest of the feature split to `MIR-18-b` (ADR-074 decision 8), which is at `BACKLOG`.

**Empty again — `MIR-14-b` left this section for `## ARCHIVE` at its own ship on 2026-11-04.** With it, both slices of feature `MIR-14` have shipped, and its `features.md` row is set to `DONE`.

**`MIR-14-b` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-04 from `04-review.md` (`produced_at: 2026-11-04T10:48:55+07:00`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-14-b` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-11-04 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-04T03:45:02Z`). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-14-b` moved here at /advance on 2026-11-04**, from `01-plan.md` gate PASS (`produced_at: 2026-11-04T01:23:40Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-073](../registry/decisions/ADR-073-one-decider-on-any-of-the-owners-teams-decides-a-multi-team-entry.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`), no new ADR. MIR-14-b had no row in `## BACKLOG`, so no row left that table.

**Empty again — `MIR-14` left this section for `## ARCHIVE` at its own ship on 2026-11-03.** Its queue slice `MIR-14-b` stays at `BACKLOG`; the shared `MIR-14` row in `features.md` stays `PLANNED` until MIR-14-b ships.

**`MIR-14` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-03 from `04-review.md` (`produced_at: 2026-11-03T17:31:50+07:00`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-14` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-11-03 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-03T10:18:12Z`). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-14` moved here at /advance on 2026-11-03**, from `01-plan.md` gate PASS (`produced_at: 2026-11-03T09:20:00Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-073](../registry/decisions/ADR-073-one-decider-on-any-of-the-owners-teams-decides-a-multi-team-entry.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`) and ADR-070. MIR-14 had no row in `## BACKLOG`, so no row left that table. The queue half split to `MIR-14-b` (ADR-073 decision 9), which is at `BACKLOG`.

**Empty again — `MIR-13-b` left this section for `## ARCHIVE` at its own ship on 2026-11-03.** With it, both slices of feature `MIR-13` have shipped, and its `features.md` row is set to `DONE`.

**`MIR-13-b` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-03 from `04-review.md` (`produced_at: 2026-11-03T07:30:37Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-13-b` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-11-03 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-03T07:14:00Z`). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-13-b` moved here at /advance on 2026-11-03**, from `01-plan.md` gate PASS (`produced_at: 2026-11-03T06:55:00Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-072](../registry/decisions/ADR-072-reads-that-feed-the-absence-count-resolve-to-the-primary-team.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`) and ADR-070. MIR-13-b had no row in `## BACKLOG`, so no row left that table.

**Empty again — `MIR-13` left this section for `## ARCHIVE` at its own ship on 2026-11-03.** Its read slice `MIR-13-b` stays at `BACKLOG`; the shared `MIR-13` row in `features.md` stays `PLANNED` until MIR-13-b ships.

**`MIR-13` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-11-03 from `04-review.md` (`produced_at: 2026-11-03T04:30:10Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-13` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-11-03 from `03-impl-log.md` gate PASS (`produced_at: 2026-11-03T02:54:16Z`). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-13` moved here at /advance on 2026-11-03**, from `01-plan.md` gate PASS (`produced_at: 2026-11-03T01:55:00Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-070](../registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md) and [ADR-071](../registry/decisions/ADR-071-writers-stamp-org-id-membership-mirrors-member-team-id-and-mir-13-splits-by-operation.md) (`ACCEPTED by tech-lead-design` under ADR-008). MIR-13 had no row in `## BACKLOG`, so no row left that table. Its read slice, `MIR-13-b`, is at `BACKLOG` and depends on MIR-13.

**Empty again — `MIR-12` left this section for `## ARCHIVE` at its own ship on 2026-11-01.**

**`MIR-12` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-31 from `04-review.md` (`produced_at: 2026-10-31T12:38:46Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-12` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-10-31 from `03-impl-log.md` gate PASS (`produced_at: 2026-10-31T12:24:00Z`). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-12` moved here at /advance on 2026-10-31**, from `01-plan.md` gate PASS (`produced_at: 2026-10-31T12:02:00Z`) with all six Definition of Ready items passing; `schema_delta` cites [ADR-070](../registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`). MIR-12 had no row in `## BACKLOG`, so no row left that table.

**Empty again — `MIR-11` left this section for `## ARCHIVE` at its own ship on 2026-10-27.**

**`MIR-11` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-27 from `04-review.md` (`produced_at: 2026-10-27T04:38:30Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-11` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-10-27 from `03-impl-log.md` gate PASS (`produced_at: 2026-10-27T04:11:00Z`). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-11` moved here at /advance on 2026-10-27**, from `01-plan.md` gate PASS with all six Definition of Ready items passing; `schema_delta` cites [ADR-070](../registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md) (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`) and [ADR-059](../registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md) (`ACCEPTED by the operator`). MIR-11 had no row in `## BACKLOG`, so no row left that table.

**Empty again — `MIR-10` left this section for `## ARCHIVE` at its own ship on 2026-10-27.**

**`MIR-10` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-27 from `04-review.md` (`produced_at: 2026-10-27T03:29:30Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-10` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-10-27 from `03-impl-log.md` gate PASS (`produced_at: 2026-10-27T03:23:38Z`). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-10` moved here at /advance on 2026-10-27**, from `01-plan.md` gate PASS with all six Definition of Ready items passing; `schema_delta: "none"`, with [ADR-070](../registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md) `ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`. MIR-10 had no row in `## BACKLOG`, so no row left that table.

**Empty again — `MIR-09` left this section for `## ARCHIVE` at its own ship on 2026-10-27.**

**`MIR-09` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-27 from `04-review.md` (`produced_at: 2026-10-27T01:49:43Z`): `gate: PASS`, `verdict: PASS`, `invariant_violation: false`, `route_to: none`. `state` stays `REVIEW`; `/ship` sets `DONE` and moves the row to `## ARCHIVE`.

**`MIR-09` was at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-10-27 from `03-impl-log.md` gate PASS (re-run, `produced_at: 2026-10-27T01:35:30Z`), after `tech-lead-design` answered `99-questions.md` and amended `01-plan.md` to add `tests/draft-entry.test.ts` to `allowed_paths` (`size: "M"`, twelve paths). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-09` was at `IN_PROGRESS` in `ticket.yaml`, blocked** — recorded at /advance on 2026-10-23 from `03-impl-log.md` gate BLOCKED, `next_state: IN_PROGRESS`. Every plan §4 contract item is implemented and typecheck/lint/the rest of the unit suite are green; the one red command is `pnpm test`'s pre-existing `tests/draft-entry.test.ts` AC-14 charter-refusal-6 scanner, which the developer reads as a false positive against the new `team_overload_threshold_range` check constraint (validates the admin's own input, does not consult the column to refuse a write to a different table). The developer cannot fix the scanner itself — `tests/draft-entry.test.ts` is outside `allowed_paths` (RULE-03) — and asked `tech-lead-design` in `99-questions.md` to either widen `allowed_paths` and narrow the scanner, or say the constraint should not ship. Unanswered. The row stays here until that question is answered and `/implement` resumes.

**`MIR-09` moved here at /advance on 2026-10-23**, from `01-plan.md` gate PASS with all six Definition of Ready items passing; `schema_delta` cites [ADR-069](../registry/decisions/ADR-069-member-team-id-is-indexed-and-the-overload-threshold-is-checked-in-the-database.md), `ACCEPTED by tech-lead-design under the operator's delegation (ADR-008)`. MIR-09 had no row in `## BACKLOG`, so no row left that table.

**Empty again — `MIR-08` left this section for `## ARCHIVE` at its own ship on 2026-10-23.**

**`MIR-08` is at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-23 from the re-run `04-review.md` (verdict PASS, `produced_at: 2026-10-23T07:28:26Z`), after the allow rules in [#176](https://github.com/didi-code0980/calechip/pull/176) let R1–R3 actually run. The row stays here until `/ship` moves it to `## ARCHIVE`. (The table row briefly shown here while the ticket was `ESCALATED` is removed: `ticket.yaml` is authoritative and this file is the view, repaired to match it.)

**Empty again — `MIR-08` left this section for `## BLOCKED` at /advance on 2026-10-23**, `ESCALATED` from `04-review.md` verdict BLOCKED, `route_to: human`. No row in `## BACKLOG` or `## READY` to catch up.

**`MIR-08` is at `REVIEW` in `ticket.yaml`, `gates.review` not yet passed** — recorded at /advance on 2026-10-23 from `03-impl-log.md` gate PASS (re-run, `produced_at: 2026-10-23T06:57:19Z`). The lint blocker below was not resolved by `tech-lead-design`; it was fixed independently, outside this ticket, by `4f9197e` ("fix(runner): lint error from ADR-067..."), now in this branch's history, which left `99-questions.md`'s question moot. `pnpm exec eslint .` is clean on the re-run; typecheck and the 987 unit tests stay green.

**`MIR-08` was at `IN_PROGRESS` in `ticket.yaml`, blocked** — recorded at /advance on 2026-10-23 from `03-impl-log.md` gate BLOCKED, `next_state: IN_PROGRESS`. The deletion of `supabase/db.sql` and both comment edits are complete and typecheck/unit-test clean; the one red command is repo-wide `pnpm exec eslint .` failing on a pre-existing, out-of-`allowed_paths` error in `scripts/run-loop.mjs` (predates this ticket's branch). The developer asked `tech-lead-design` in `99-questions.md` whether the gate may pass on that basis or whether `allowed_paths` should widen; unanswered — no live `tech-lead-design` session in this run. The row stays here until that question is answered and `/implement` resumes.

**`MIR-08` moved here at /advance on 2026-10-23**, from `01-plan.md` gate PASS with all six Definition of Ready items passing; `schema_delta: none`. MIR-08 had no row in `## BACKLOG`, so no row left that table.

**Empty again — `MIR-07` left this section for `## ARCHIVE` at its own ship on 2026-10-23.**

**`MIR-07` is at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-23 from `04-review.md` verdict PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-07` moved here at /advance on 2026-10-23**, from `01-plan.md` gate PASS with all six Definition of Ready items passing; `schema_delta: none`. MIR-07 had no row in `## BACKLOG`, so no row left that table.

**Empty again — `MIR-06` left this section for `## ARCHIVE` at its own ship on 2026-10-23.**

**`MIR-06` is at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-23 from `04-review.md` verdict PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`MIR-06` moved here at /advance on 2026-10-23**, from `01-plan.md` gate PASS with all six Definition of Ready items passing; `schema_delta: none`. MIR-06 had no row in `## BACKLOG`, so no row left that table.

**Empty again — `MIR-05` left this section for `## ARCHIVE` at its own ship on 2026-10-21.**

**`MIR-05` moved here at /advance on 2026-10-21**, from `01-plan.md` gate PASS with all six Definition of Ready items passing; `schema_delta: none`. MIR-05 had no row in `## BACKLOG`, so no row left that table.

**Empty again — `MIR-01` left this section for `## ARCHIVE` at its own ship on 2026-10-21.** Phase 0 is shipped in the loop; the key rotation itself and the `Result:` lines of `verification.md` are the operator's.

**`MIR-01` moved here at /advance on 2026-10-21**, from `01-plan.md` gate PASS with all six Definition of Ready items passing; `schema_delta: none`. `feat/MIR-01` was re-cut from `main` after PR #167 and re-planned: the earlier parked `READY` copy named in the paragraphs below was on no ref when this ran. MIR-01 had no row in `## BACKLOG` on `main`, so no row left that table.

**Empty again — `MIR-04` left this section for `## ARCHIVE` at its own ship on 2026-10-21.** Phase 0 is shipped except `MIR-01`, parked on `feat/MIR-01`.

**`MIR-04` moved here at /advance on 2026-10-20**, from `01-plan.md` gate PASS with all six Definition of Ready items passing; `schema_delta` cites [ADR-066](../registry/decisions/ADR-066-the-member-directory-is-own-team-plus-people-the-caller-already-shares-an-event-with.md), `ACCEPTED by the operator`. Cut from `main` after PR #166; the `MIR` rows of `## BACKLOG` are still only on `feat/MIR-01`, so no row left that table on this branch. `MIR-01` stays parked at `READY` on `feat/MIR-01`.

**Empty again — `MIR-03` left this section for `## ARCHIVE` at its own ship on 2026-10-20.**

**`MIR-03` moved here at /advance on 2026-10-20**, from `01-plan.md` gate PASS with all six Definition of Ready items passing; `schema_delta` cites [ADR-065](../registry/decisions/ADR-065-role-changes-are-own-team-promotion-is-its-own-action-and-every-change-is-recorded.md), `ACCEPTED by the operator`. Cut from `main` after PR #165; the `MIR` rows of `## BACKLOG` are still only on `feat/MIR-01`.

**Empty again — `MIR-02` left this section for `## ARCHIVE` at its own ship on 2026-10-20.** `MIR-01` is parked at `READY` on `feat/MIR-01`, not on this branch.

**`MIR-02` moved here at /advance on 2026-10-20**, from `01-plan.md` gate PASS with all six Definition of Ready items passing; `schema_delta` cites [ADR-064](../registry/decisions/ADR-064-a-person-cannot-change-their-own-role-status-or-team.md), `ACCEPTED by the operator`. **This branch was cut from `main` while `MIR-01` was parked on `feat/MIR-01`** (operator, 2026-10-20: *"ignore MIR-01 bắt đầu MIR-02 trước"*), so the `MIR` rows of `## BACKLOG` and `MIR-01`'s `READY` row are not in this copy; they are on `feat/MIR-01`. Whichever of the two pull requests merges second reconciles this file. WIP is 2 against a limit of 1, by the operator's decision.

**Empty again — `TSK-06` left this section for `## ARCHIVE` at its own ship on 2026-10-18.** The `TSK` group in `## BACKLOG` is empty.

**`TSK-06` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-18 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. The row stays here until `/ship` moves it to `## ARCHIVE`. Its size column now reads `L`, transcribed from `ticket.yaml` (`size: "L"`, seventeen paths, amended at IN_PROGRESS); it read `M`.

**`TSK-06` moved here from `## BACKLOG` at /advance on 2026-10-18**, from `01-plan.md` gate PASS with all six Definition of Ready items passing; `schema_delta` cites ADR-062, `ACCEPTED by the operator`. It was row 2, planned ahead of `CICD-08` on the operator's choice. Bookkeeping, not a reordering.

**Empty again — `TSK-04` left this section for `## ARCHIVE` at its own ship on 2026-10-18.** The `TSK` group in `## BACKLOG` is empty; `CICD-08` is the top row.

**`TSK-04` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-18 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`TSK-04` moved here from `## BACKLOG` at /advance on 2026-10-17**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. It was row 2, planned ahead of `CICD-08` on the operator's choice. Bookkeeping, not a reordering.

**Empty again — `TSK-03` left this section for `## ARCHIVE` at its own ship on 2026-10-17.** `TSK-04` is the next TSK row of `## BACKLOG`.

**`TSK-03` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-17 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`TSK-03` moved here from `## BACKLOG` at /advance on 2026-10-17**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. It was row 2, planned ahead of `CICD-08` on the operator's choice; `TSK-04` moved up one row. Bookkeeping, not a reordering.

**Empty again — `TSK-02` left this section for `## ARCHIVE` at its own ship on 2026-10-17.** `TSK-03` is the next TSK row of `## BACKLOG`; `CICD-08` is in `## BLOCKED`.

**`TSK-02` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-17 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`TSK-02` moved here from `## BACKLOG` at /advance on 2026-10-17**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. It was row 2, planned ahead of `CICD-08` on the operator's choice (*"move to feature TSK"*); `TSK-03` and `TSK-04` each moved up one row. Bookkeeping, not a reordering.

**Empty again — `TSK-05` left this section for `## ARCHIVE` at its own ship on 2026-10-16.** `CICD-08` is the top of `## BACKLOG`.

**`TSK-05` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-16 from the re-review `04-review.md` (verdict PASS, 08:04), after the rewritten `03-impl-log.md` (gate PASS, 07:50). The row stays here until `/ship` moves it to `## ARCHIVE`. Before that, **`TSK-05` was back at `READY`** — recorded at /advance on 2026-10-16 from the amended `01-plan.md` (gate PASS, § 4.1 `applyOutcome`, § 4.2 applies every outcome; `allowed_paths` and size unchanged). `/implement` runs again against it. Before that: **`TSK-05` was at `REWORK` in `ticket.yaml`, routed to `tech-lead-design`** — recorded at /advance on 2026-10-16 from `04-review.md` verdict FAIL on R5 (plan § 4.2 cannot meet AC-3/AC-4: after a successful write followed by a failed one the row shows a value the server does not hold). `rework_count` stays 0 — RULE-08, an upstream defect does not burn the Developer's budget.

**`TSK-05` moved here from `## BACKLOG` at /advance on 2026-10-15**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. It was row 5 and was planned ahead of `CICD-08` and `TSK-02` to `TSK-04` on the operator's choice. Bookkeeping, not a reordering of the rest. The paragraphs below were written while this table was empty and are left standing.

**Empty again — `TSK-01` left this section for `## ARCHIVE` at its own ship on 2026-10-15.** `CICD-08` is the top of `## BACKLOG`.

**`TSK-01` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-15 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`TSK-01` moved here from `## BACKLOG` at /advance on 2026-10-15**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. It was row 2 and was planned ahead of `CICD-08` on the operator's choice; `TSK-02` to `TSK-04` each moved up one row. Bookkeeping, not a reordering. The paragraphs below were written while this table was empty and are left standing.

**Empty again — `EVT-14` left this section for `## ARCHIVE` at its own ship on 2026-10-15.** `CICD-08` is the top of `## BACKLOG`.

**`EVT-14` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-15 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`EVT-14` moved here from `## BACKLOG` at /advance on 2026-10-15**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. It was row 6 and was planned ahead of `CICD-08` and `TSK-01` to `TSK-04` on the operator's choice, after `UIE-12`. Bookkeeping, not a reordering of the rest. The paragraphs below were written while this table was empty and are left standing.

**Empty again — `UIE-12` left this section for `## ARCHIVE` at its own ship on 2026-10-15.** `CICD-08` is the top of `## BACKLOG`.

**`UIE-12` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-15 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS (both stages ran before this /advance). `size` went S → M at the developer's Q1, which added `src/components/AppShell.tsx` to `allowed_paths`; AC-9 was amended at Q2 (`99-questions.md`). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`UIE-12` moved here from `## BACKLOG` at /advance on 2026-10-15**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. It was row 6 and was planned ahead of `CICD-08` and `TSK-01` to `TSK-04` on the operator's choice; `EVT-14` moved up one row. Bookkeeping, not a reordering of the rest. The paragraphs below were written while this table was empty and are left standing.

**Empty again — `EVT-13` left this section for `## ARCHIVE` at its own ship on 2026-10-15.** `CICD-08` is the top of `## BACKLOG`.

**`EVT-13` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-15 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. `allowed_paths` grew from ten to twelve at the developer's Q1, answered by `tech-lead-design` (`99-questions.md`, `01-plan.md` amendment). The row stays here until `/ship` moves it to `## ARCHIVE`.

**`EVT-13` moved here from `## BACKLOG` at /advance on 2026-10-15**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. `CICD-08` to `TSK-04` each moved up one row in `## BACKLOG`; bookkeeping, not a reordering. The paragraphs below were written while this table was empty and are left standing.

**Empty again — `EVT-12` left this section for `## ARCHIVE` at its own ship on 2026-10-14.** `EVT-13` is the top of `## BACKLOG`.

**`EVT-12` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-14 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`EVT-12` moved here from `## BACKLOG` at /advance on 2026-10-14**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. `EVT-13` to `TSK-04` each moved up one row in `## BACKLOG`; bookkeeping, not a reordering. The paragraphs below were written while this table was empty and are left standing.

**Empty again — `CICD-07` left this section for `## ARCHIVE` at its own ship on 2026-10-14.** `CICD-04` is the top of `## BACKLOG`.

**`CICD-07` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-14 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`CICD-07` moved here from `## BACKLOG` at /advance on 2026-10-14**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. `CICD-08` to `EVT-13` each moved up one row in `## BACKLOG`; bookkeeping, not a reordering. The paragraphs below were written while this table was empty and are left standing.

**Empty again — `CICD-06` left this section for `## ARCHIVE` at its own ship on 2026-10-14.** `TSK-01` is the top of `## BACKLOG`; the `CICD` group is complete.

**`CICD-06` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-14 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`CICD-06` moved here from `## BACKLOG` at /advance on 2026-10-14**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. `TSK-01` to `TSK-04` each moved up one row in `## BACKLOG`; bookkeeping, not a reordering. The paragraphs below were written while this table was empty and are left standing.

**Empty again — `CICD-05` left this section for `## ARCHIVE` at its own ship on 2026-10-14.** `CICD-06` is the top of `## BACKLOG`.

**`CICD-05` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-14 from the re-run `04-review.md` verdict PASS, after the operator's exception for `TopBar.tsx`. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`CICD-05` returned here from `## BLOCKED` on 2026-10-14** on the operator's decision (option 3, accepted exception for `TopBar.tsx`); `state: REVIEW`, `gates.review` not passed, `/review` re-runs.

**Empty again — `CICD-05` left this section for `## BLOCKED` at /advance on 2026-10-14**, `ESCALATED` from `04-review.md` verdict FAIL, `route_to: human`. `CICD-06` is the top of `## BACKLOG` but depends on `CICD-05`.

**`CICD-05` moved here from `## BACKLOG` at /advance on 2026-10-14**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. `CICD-06` to `TSK-04` each moved up one row in `## BACKLOG`; bookkeeping, not a reordering. The paragraphs below were written while this table was empty and are left standing.

**Empty again — `CICD-04` left this section for `## ARCHIVE` at its own ship on 2026-10-14.** `CICD-05` is the top of `## BACKLOG`.

**`CICD-04` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-14 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`CICD-04` moved here from `## BACKLOG` at /advance on 2026-10-14**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. `CICD-05` to `TSK-04` each moved up one row in `## BACKLOG`; bookkeeping, not a reordering. The paragraphs below were written while this table was empty and are left standing.

**Empty again — `CICD-03` left this section for `## ARCHIVE` at its own ship on 2026-10-13.** `CICD-04` is the top of `## BACKLOG`.

**`CICD-03` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-13 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`CICD-03` moved here from `## BACKLOG` at /advance on 2026-10-13**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. `CICD-04` to `TSK-04` each moved up one row in `## BACKLOG`; bookkeeping, not a reordering. The paragraphs below were written while this table was empty and are left standing.

**Empty again — `CICD-02` left this section for `## ARCHIVE` at its own ship on 2026-10-13.** `CICD-03` is the top of `## BACKLOG`.

**`CICD-02` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-13 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`CICD-02` moved here from `## BACKLOG` at /advance on 2026-10-13**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. `## BACKLOG` is renumbered from 1: it started at row 2 after `CICD-01` left it without a renumber. `CICD-03` to `TSK-04` each moved up; bookkeeping, not a reordering. `BUG-003` to `BUG-005` are at `BACKLOG` in `ticket.yaml` and still have no row — placing them is a human's. The paragraphs below were written while this table was empty and are left standing.

**`CICD-01` moved here from `## BACKLOG` at /advance on 2026-10-13**, from `01-plan.md` gate PASS. Definition of Ready items 1, 2, 3, 4 and 6 pass; **item 5 (`size_estimate` is S or M) is waived by the operator**, who chose "Accept L unsplit" on 2026-10-13 (`01-plan.md` Changelog). The rows below it in `## BACKLOG` keep their order.

**Empty again — `CICD-01` left this section for `## ARCHIVE` at its own ship on 2026-10-13.** `CICD-02` is the top of `## BACKLOG`.

**`CICD-01` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-13 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**Empty again — `EVT-11` left this section for `## ARCHIVE` at its own ship on 2026-10-13.** `TSK-01` is the top of `## BACKLOG`.

**`EVT-11` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-13 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`EVT-11` moved here from `## BACKLOG` at /advance on 2026-10-13**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. `TSK-01` to `TSK-04` each moved up one row in `## BACKLOG`; bookkeeping, not a reordering. The paragraphs below were written while this table was empty and are left standing.

**Empty again — `EVT-10` left this section for `## ARCHIVE` at its own ship on 2026-10-13.** `EVT-11` is the top of `## BACKLOG`.

**`EVT-10` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-13 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`EVT-10` moved here from `## BACKLOG` at /advance on 2026-10-12**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. `EVT-11` to `TSK-04` each moved up one row in `## BACKLOG`; bookkeeping, not a reordering. The paragraphs below were written while this table was empty and are left standing.

**Empty again — `EVT-09` left this section for `## ARCHIVE` at its own ship on 2026-10-12.** `EVT-10` is the top of `## BACKLOG`.

**`EVT-09` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-12 from `04-review.md` verdict PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`EVT-09` moved here from `## BACKLOG` at /advance on 2026-10-12**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. `EVT-10` to `TSK-04` each moved up one row in `## BACKLOG`; bookkeeping, not a reordering. The paragraphs below were written while this table was empty and are left standing.

**Empty again — `EVT-08` left this section for `## ARCHIVE` at its own ship on 2026-10-12.** `EVT-09` is the top of `## BACKLOG`.

**`EVT-08` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-12 from `04-review.md` verdict PASS, after `03-impl-log.md` gate PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`EVT-08` moved here from `## BACKLOG` at /advance on 2026-10-12**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. `EVT-09` to `EVT-11` each moved up one row in `## BACKLOG`; bookkeeping, not a reordering. The paragraphs below were written while this table was empty and are left standing.

**Empty again — `EVT-07` left this section for `## ARCHIVE` at its own ship on 2026-10-09.** `## BACKLOG` is empty too: the board holds no open ticket, and `/triage` is what produces the next one.

**`EVT-07` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-09 from `04-review.md` verdict PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`EVT-07` moved here from `## BACKLOG` at /advance on 2026-10-09**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. `## BACKLOG` is now empty. Its *Blocked on* read `EVT-06`, which is `DONE` and merged (#117).

**Empty again — `EVT-06` left this section for `## ARCHIVE` at its own ship on 2026-10-09.** `EVT-07` is the top of `## BACKLOG`.

**`EVT-06` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-09 from `04-review.md` verdict PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`EVT-06` moved here from `## BACKLOG` at /advance on 2026-10-09**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. `EVT-07` moved up one row in `## BACKLOG`; bookkeeping, not a reordering.

**Empty again — `EVT-05` left this section for `## ARCHIVE` at its own ship on 2026-10-09.** `EVT-06` is the top of `## BACKLOG`.

**`EVT-05` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-09 from `04-review.md` verdict PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`EVT-05` moved here from `## BACKLOG` at /advance on 2026-10-09**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. It was planned ahead of `EVT-06`, row 1 there, once Q6 was answered; `EVT-07` moved up one row.

**Empty again — `EVT-04` left this section for `## ARCHIVE` at its own ship on 2026-10-08.** `EVT-05` is the top of `## BACKLOG`, still blocked on the operator.

**`EVT-04` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-08 from `04-review.md` verdict PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`EVT-04` moved here from `## BACKLOG` at /advance on 2026-10-08**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. `EVT-05` to `EVT-07` each moved up one row in `## BACKLOG`; bookkeeping, not a reordering.

**Empty again — `EVT-03` left this section for `## ARCHIVE` at its own ship on 2026-10-08.** `EVT-04` is the top of `## BACKLOG`.

**`EVT-03` was at `REVIEW` in `ticket.yaml`, `gates.review` passed** — recorded at /advance on 2026-10-08 from `04-review.md` verdict PASS. The row stays here until `/ship` moves it to `## ARCHIVE`.

**`EVT-03` moved here from `## BACKLOG` at /advance on 2026-10-08**, from `01-plan.md` gate PASS with all six Definition of Ready items passing. `EVT-04` to `EVT-07` each moved up one row in `## BACKLOG`; bookkeeping, not a reordering. The paragraph below was written while this table was empty and is left standing.

**Empty — `CAL-12` left this section for `## ARCHIVE` at its own ship on 2026-10-01**, and nothing is
behind it. `## BACKLOG` is empty too, so **the board holds no open ticket at all**: `/triage` is what
produces the next one.

**`CAL-12` was the last of a run of four shipped in three days** — `EVT-01` and `EVT-02` on
2026-09-29, `CAL-12` on 2026-10-01 — and the only one of the four that had to be built twice.

**It is also the first ticket to reach `/ship` with a clean working tree.** The three ADR-048
checkpoints its `/advance` runs committed already held the plan, the source, the tests and all four
artifacts, so the ship commit carried only the state transition and the board and registry rows. That
mechanism exists because this ticket's first attempt was lost entirely — MD-042, and ADR-006
§ *Revert condition* met for the first time.


## BACKLOG

Tickets awaiting PLAN. **Ordered.** A human reorders; the orchestrator takes the top.

Under the current gate placement a ticket sits here until it has been planned — DoR is evaluated
*after* PLAN. A row still at `BACKLOG` has not failed DoR; it has not reached it.

| # | Ticket | Title | State | Blocked on |
|---|--------|-------|-------|------------|
| 1 | CICD-08 | Every stage of the pipeline has run once for real — a pull request, a merge, a pre-release tag and a forced failed health check — and the evidence is recorded | BACKLOG | CICD-07; operator: Actions secrets, deployment repo applied, runner registered, branch protection |

**Row 2 was appended by `product` at /triage on 2026-10-18**, from `.ai/board/ideas/2026-10-18-the-task-page-shows-one-day-at-a-time-and-a-task-has-no-time.md`. Appended, not placed. Its `depends_on` names `TSK-01`, `TSK-02`, `TSK-03` and `TSK-05`, all `DONE`, so *Blocked on* is `—`. It rests on [ADR-062](../registry/decisions/ADR-062-a-task-may-carry-an-optional-time-of-day.md), `ACCEPTED by the operator`; the migration it brings is applied by a human (RULE-09).

**Row 5 was appended by `product` at /triage on 2026-10-15**, from `.ai/board/ideas/2026-10-15-ticking-a-task-done-waits-two-round-trips-and-locks-the-box.md`. Appended, not placed. Its `depends_on` names `TSK-01`, which is `DONE`, so *Blocked on* is `—`.

**Reordered by the operator on 2026-10-14** (*"back về làm EVT"*): `EVT-12` and `EVT-13` to rows 1 and 2, ahead of `CICD-08` and `TSK-01` to `TSK-04`, whose order among themselves is unchanged. Recorded by `orchestrator`, not decided by it. `BUG-003` to `BUG-005` still have no row; placing them is the operator's.

**Rows 7 and 8 were appended by `product` at /triage on 2026-10-14**, from `.ai/board/ideas/2026-10-14-a-team-or-named-event-cannot-invite-anyone-by-email.md`. Split at triage: the invitation pipe and its two surfaces, then the guest-link redirect, which touches neither. Both rest on [ADR-061](../registry/decisions/ADR-061-invitations-reach-every-event-scope-and-a-signed-in-reader-leaves-the-guest-page.md). Appended, not placed; the operator said *"ignore the CICD back to EVT"* the same afternoon, so they may want these above `CICD-07`.

**Rows 6 and 7 (numbered 9 and 10 before the merge with main) were appended by `product` at /triage on 2026-10-14**, from `.ai/board/ideas/2026-10-14-the-way-to-join-an-event-scrolls-out-of-sight-and-a-guest-cannot-sign-in-from-it.md`. Split at triage: the sticky join block on both event pages, then the guest sign-in prompt with its return-to. Both edit `src/routes/GuestEvent.tsx`, so they run one after the other. Appended, not placed.

**Rows 1 and 2 were added at triage on 2026-10-14**, from a gap check of the CI/CD request against what `CICD-01` to `CICD-06` shipped. They are placed above the `TSK` rows because the request is one piece of work and these close it; the operator may reorder. `TSK-01` to `TSK-04` each moved down two rows.

**`EVT-08` left this table at /advance on 2026-10-12 and shipped the same evening ([#124](https://github.com/didi-code0980/calechip/pull/124)); every row below it moved up one, so the `TSK` rows the paragraph below calls 5 to 8 are now 4 to 7.** Bookkeeping, not a reordering.

**Rows 5 to 8 were appended by `product` at /triage on 2026-10-12**, from `.ai/board/ideas/2026-10-12-a-member-has-nowhere-to-plan-their-own-day-and-an-absence-hides-what-was-due.md`. Split at triage: the task table and page first, then the overdue prompt, the PTO warning and the week badge, each depending only on `TSK-01`. They rest on [ADR-057](../registry/decisions/ADR-057-a-task-is-readable-and-writable-by-its-owner-only.md), `ACCEPTED by the operator`, and [ADR-058](../registry/decisions/ADR-058-tsk-is-a-sixth-feature-group.md), `ACCEPTED by product`. They sit below the `EVT` rows because those were already here, not because anybody placed them. **Owed and not any ticket's:** the charter paragraph under § *Roles* and the no-time sentence beside refusal 3, plus the `task` rows in `rbac-and-security.md` and `data-model.md`. Those are human and standards plane, so `/thuki` lands them, or `/plan` of `TSK-01` puts them in `allowed_paths` with approval.

**Rows 3 and 4 were appended by `product` at /triage on 2026-10-12**, from `.ai/board/ideas/2026-10-12-an-event-description-cannot-carry-formatting-or-a-picture.md`. Split at triage: formatting, then pictures. Both rest on [ADR-056](../registry/decisions/ADR-056-an-event-description-is-sanitised-html-from-one-editor.md), `ACCEPTED by the operator`. They sit below `EVT-08` and `EVT-09` because those were already here, not because anybody placed them. `EVT-09` edits the same form, but neither row depends on it. **Owed and not either ticket's:** the `.ai/standards/tech-stack.md` rows for the editor and the sanitiser. That file is standards plane, and a human or the steward writes them once `/plan` of `EVT-10` names the packages.

**Rows 1 and 2 were appended by `product` at /triage on 2026-10-12**, from `.ai/board/ideas/2026-10-12-a-person-outside-the-product-learns-of-a-public-event-only-by-a-forwarded-link.md`. Split at triage by surface: the detail page carries the whole pipe, the create form adds the field. Rows 1 and 2 because the table was empty, not because anybody placed them. `EVT-08`'s `depends_on` names `EVT-05` and `EVT-06`, both `DONE`, so its *Blocked on* is `—`. The paragraphs below were written while the table held other rows and are left standing.

**Reordered by the operator on 2026-10-08** (*"thôi chuyển qua làm EVT-06 trước"*): `EVT-06` above `EVT-05`, which waits on the Gmail decision (Q6 — cách A or B, the account, and who holds it). `EVT-05`'s *Blocked on* drops `EVT-04`, which is `DONE` and merged.

**Rows 2 and 3 were appended by `product` at /triage on 2026-10-08**, from `.ai/board/ideas/2026-10-08-a-person-learns-about-an-event-only-by-going-to-look.md`. Split at triage on the operator's Q7. They sit below `EVT-03` because it was already here, not because anybody placed them.

**Rows 4 and 5 were appended by `product` at /triage on 2026-10-08**, from `.ai/board/ideas/2026-10-08-a-gathering-cannot-include-anyone-without-an-account.md`. Split at triage: the read half, then the write half. Appended, not placed.

**Row 1 was appended by `product` at /triage on 2026-10-08**, from `.ai/board/ideas/2026-10-08-an-event-is-invisible-from-the-calendar-it-happens-on.md`. It is row 1 because the table was empty, not because anybody placed it. The paragraphs below were written while the table held other rows and are left standing.

**Both `EVT` rows have now left this table.** `EVT-01` was row 2 until `/advance` on 2026-09-29
moved it to `## READY`, and it has since shipped; `EVT-02` became row 2 and left the same way later
the same day. `CAL-12` is the only row here and is row 1 in its own right.

**`CAL-12`'s *Blocked on* column read `CAL-11` until 2026-09-29 and now reads `—`:** `CAL-11` has
been `DONE` since 2026-09-23 and its pull request is merged, so the column was stale rather than
wrong at the time. The paragraph below is left as written because it records the placement.

**Rows 2 and 3 were appended by `product` at /triage on 2026-09-29**, from
`.ai/board/ideas/2026-09-29-a-gathering-has-nowhere-to-be-announced-or-joined.md`, whose
`## Re-triage verdict — PROMOTE, as EVT-01 then EVT-02` section is the reasoning. They sit below
`CAL-12` because it was already here, not because anybody placed them. **Split at triage** for the
reason UIE-09/UIE-10 were (MD-017). **`EVT-01` owes the charter amendment** ADR-045 records, unless
`/thuki` lands it first.

**Rows 1 and 2 were appended by `product` at /triage on 2026-09-22**, from
`.ai/board/ideas/2026-09-22-an-admin-manages-every-team-and-sees-only-one-calendar.md`, whose
`## Re-triage verdict — PROMOTE, as CAL-11 then CAL-12` section is the reasoning. They were rows 1
and 2 because the table was empty, not because anybody placed them; **CAL-11 moved to `## READY` at
/advance on 2026-09-23** and CAL-12 is row 1 here in its own right, still blocked on it.
**Owed and not either ticket's:** the
standards ADR-039 and ADR-040 name as affected (`rbac-and-security.md`, `data-model.md`,
`architecture.md`) still say one team — `/thuki`'s on an `ops/<slug>` branch.

***THIS TABLE IS EMPTY FOR THE SIXTH TIME.*** `UIE-10` left it for `## ARCHIVE` at /ship on
2026-09-09, and all thirty-six tickets on the board are `DONE`. The paragraphs below were written
while it still held rows and are left standing rather than rewritten, on this file's convention.

***THE RISK THE TWO-ROW SPLIT EXISTED TO ISOLATE WAS PAID IN FULL, AND IT COST WHAT THE TRIAGE SAID
IT WOULD.*** UIE-10 is where the four `home-*-link` ids left `src/components/Sidebar.tsx` and where
the **17 visibility assertions across five shipped tickets** were rewritten to route through the hub.
**Six of those were the vacuous ones** — negative assertions satisfied by a name never having existed
— and the plan owed an answer for which node asserts the member case instead. It wrote one, and the
review re-derived it. **The split was the reason none of that landed as a surprise**, which is worth
recording because the split cost an extra ticket and MD-017 says nothing in the model would have
produced it automatically.

**WHAT IS OWED AND IS NOT THIS TICKET'S**, both left dirty by this ship and both `/thuki`'s on an
`ops/<slug>` branch: `.ai/board/model-debt.md` (the MD-030 amendment recording that CAL-10's design
image is the first image byte this repository holds) and `.ai/standards/ui-design-system.md` (the
matching correction under § *Visual specification*). `04-review.md` § *R1 detail* names both and
correctly refused to touch either.

**`UIE-09` left this table for `## ARCHIVE` at /ship on 2026-09-09**, and `UIE-10` became row 1.
Bookkeeping, not a reordering. **`UIE-10`'s `Blocked on` is cleared in the same write**: it named
`UIE-09`, and `UIE-09` is now `DONE` — Definition of Ready item 3 reads `depends_on` in `ticket.yaml`
and not this column, so this is the view catching up rather than a gate being opened.

**AND THE MECHANISM THAT DEPENDENCY EXISTED FOR IS NOW ARMED RATHER THAN SPENT.** The four
`home-*-link` ids are, as of this ship, in the sidebar **and** on the hub is what `UIE-10` must NOT
produce: UIE-09 gave the hub NEW `admin-hub-*` selectors precisely so no id gained a second node, and
`04-review.md` § R5 measured that no existing spec file was edited. `UIE-10` is where the four ids
leave `src/components/Sidebar.tsx`, and where the **17 visibility assertions across five shipped
tickets** stop being satisfiable — six of them vacuously. That cost is stated on its `features.md`
row and it is the whole reason the work was split; it is now the next thing the board does.

**`CAL-10` left this table for `## ARCHIVE` at /ship on 2026-09-09**, and rows 2 and 3 became rows 1
and 2. Bookkeeping, not a reordering — no row moved relative to another, and `UIE-10` stays blocked on
`UIE-09`. **`UIE-09` is now row 1 and is blocked on nothing.** The paragraph immediately below was
written while `CAL-10` held row 1 and is left standing rather than rewritten, on this file's
convention; its numbering refers to that table.

**THE SEQUENCING FACT IT NAMES HAS NOW BEEN SPENT, AND IT SPENT MORE THAN IT SAID.** `UIE-09`'s
`features.md` row records that `CAL-10` *"also edits `src/App.tsx`"* and *"moves the default year
address that five shipped criteria are written against"* — that has happened: `/year/:yyyy` now
renders the overview and the member grid is at `/year/:yyyy/members`. Whoever plans `UIE-09` reads
`src/App.tsx` as it stands on this branch, not as the triage found it.

**Rows 2 and 3 were appended by `product` at /triage on 2026-09-09**, later the same day, from
`.ai/board/ideas/2026-09-09-the-sidebar-holds-every-address-and-grows-with-the-role.md`, whose
`# Verdict — PROMOTE, as two rows: UIE-09 then UIE-10` section is the reasoning. The request was
*"change layout of left side bar, Remove all the link to admin page in sidebar. Add one 1 button to
access admin function in top bar"*, with an image. **`product` asserts nothing about position** —
they are rows 2 and 3 because `CAL-10` was already row 1 when they were written, not because anybody
placed any of the three; the header of this file says a human reorders, and putting either above a
row already here would have moved it.

**Four facts a human needs, and none of them is a priority question.**

1. ***THE SPLIT IS FORCED BY THE TEST RUNNER, NOT CHOSEN — AND ROW 3 DEPENDS ON ROW 2 FOR THAT
   REASON.*** UIE-02 AC-6 requires every `home-*` id to resolve to exactly one node and Playwright
   strict mode fails a `.click()` matching two, so the four `home-*-link` ids cannot exist in the
   sidebar and on the hub at the same time: **the hub must exist before the sidebar gives them up.**
   As one ticket the work is 14 files and therefore `L`, which must split
   (`.ai/01-operating-model.md:373`). **It was split at TRIAGE rather than at PLAN because MD-017
   records that no command owns a shell created by a split at DESIGN**, so a ticket that splits there
   loses half of itself silently. What the split buys is the second fact.
2. ***UIE-09 IS ENTIRELY ADDITIVE AND UIE-10 CARRIES ALL THE RISK, IN ONE REVIEWABLE PLACE.*** While
   `UIE-09` ships, the sidebar is untouched and **all 30 executable assertions across the 11 executing
   spec files keep passing unedited**. `UIE-10` is the migration and a reviewer should be able to read
   it as one sentence.
3. ***UIE-10 AMENDS ACCEPTANCE CRITERIA THAT FIVE `DONE` TICKETS SHIPPED, AND NO AVAILABLE SHAPE
   AVOIDS IT. THIS IS THE THING THE OPERATOR SHOULD DECIDE KNOWINGLY.*** The seven sidebar link ids
   are referenced **41 times across 12 spec files**; read line by line that is 11 comments and 30
   executable statements — **13 navigation, which one inserted step repairs, and 17 visibility, which
   nothing repairs.** Named: **ADM-01 AC-10, ADM-02 AC-15, ADM-04 AC-9, CAL-03 AC-10**, TEA-05's
   visibility pair, and in the plan plane **UIE-02 AC-6 and AC-8**. UIE-02's relocation trick does not
   save this one — it worked because the ids stayed visible from every route. **And the sharpest part
   is that the six negative assertions pass *vacuously* once the ids they name stop existing**: they
   are the only shipped statements anywhere that a member is not offered the admin surface, so a
   reviewer who sees six green assertions afterwards is seeing nothing. Which node asserts it instead
   is an AC `UIE-10` owes. **The suite was not run**, so 17 is the honest estimate of the cost and not
   a measurement of it.
4. **`schema_delta: none` on both, unfenced, and no ADR is owed.** No table, column, policy, grant,
   trigger or constraint is named by either row; the seam is untouched; every control involved is an
   affordance over row-level security already in force (ADR-005). The hub **extends** ADM-01's
   own-screen-per-setting shape rather than reversing it — `/threshold` stays `/threshold` — which is
   inside ADR-008's envelope test. `depends_on` was measured on both.

**Three things a human may want to know before either is planned, and none is its position.**

- ***THE ONE ITEM THE OPERATOR MAY WANT BACK IS DEFERRED, NOT DROPPED: the roster's five sub-groups.***
  `CORE ENGINEERING`, `FRONTEND TEAM`, `BACKEND TEAM`, `QA / TESTING`, `DESIGN / PRODUCT`, each with a
  count pill. **There is no column anywhere that groups members within a team** — `public.member`
  carries seven columns and no later migration adds one — so it is a migration, therefore `XL` and
  **a human's under RULE-09**. And before the column there is a decision: INV-07 scopes counting to
  the team, and **a count pill on every group header is one question away from a threshold per group**,
  which would give INV-04 a second arithmetic. *Is a sub-group ever a counting unit?* is the ADR. It
  is open question 9 of the idea file. **The same picture has now shown those five subtitles four
  times and nothing has acted on them** — UIE-05, UIE-06 and UIE-08 each recorded it in their
  `design/README.md` and each was out of scope, as this one is.
- **Where the operator's words and the picture differ, the words govern, and it is not a preference.**
  The request names the **admin** links; the transcription's sidebar has no nav links at all.
  `home-week-link`, `home-year-link` and `home-holidays-link` **stay**, because `periodNavFor` returns
  `null` off the period routes (`src/lib/period.ts:315`) so the top bar draws neither switcher nor
  anchor on `/allow-list`, `/members` or `/holidays` — and because **`/holidays` has exactly one link
  in the entire product**, is guarded on a session rather than a role, and **ADM-02 AC-15 asserts that
  link is offered to both roles**. Emptying the nav block entirely is available as its own idea, and
  it owes a second answer for `/holidays` first. **The first clause of the request is still served**:
  `UIE-10` carries the roster restyle — the role word on each row — which reverses
  `src/components/Sidebar.tsx:182-184` and needs a **new** selector, not a renamed one.
- **The design reference in both ticket folders is a transcription with no image beside it, and this
  is the first time one has been copied into two folders.** `.ai/board/tickets/UIE-09/design/README.md`
  and `UIE-10/design/README.md` hold the same verbatim text, each with one line at the top naming
  which half of the picture that ticket answers. **It does not close MD-030**: no role in this loop can
  write image bytes, so what is durable is prose about a picture nobody can open. `/plan` must not be
  handed a second image for either ticket.

**Row 1 was appended by `product` at /triage on 2026-09-09**, from
`.ai/board/ideas/2026-09-09-the-year-view-cannot-answer-what-the-year-looked-like.md`, whose
`# Verdict — PROMOTE, as CAL-10` section is the reasoning. **The paragraph immediately below says this
table is empty; it is left standing rather than rewritten**, on this file's convention — it was true
when UIE-08 shipped and it stopped being true when this row landed. **`product` asserts nothing about
position**: row 1 because the table was empty, not because anybody placed it there.

**Three facts a human needs, and none of them is a priority question.**

1. ***THE OTHER HALF OF THE 2026-09-08 REQUEST IS NOW ON THE BOARD, AND THE DECISION IT WAS WAITING
   FOR HAS BEEN MADE.*** The paragraph below says ADR-032 is `PROPOSED — awaiting the operator`. **The
   operator answered on 2026-09-09**, in two explicit choices: keep **both** surfaces, and make the
   overview the **default**. ADR-032 is `ACCEPTED by the operator` and is written at the filename
   eight documents already cite — **which closes 8 of the 9 errors `main`'s audit fails with**
   (MD-031, item 6 below). The first draft of that ADR, and the idea behind it, exist on no ref and
   were not recovered; this row's idea file states the problem again from source.
2. ***THE COST THE PARAGRAPH BELOW RECORDS IS RETIRED, NOT PAID.*** It warns that accepting ADR-032
   throws UIE-08's paint away rather than adjusting it. **Under "keep both" the member grid survives**,
   behaviourally unchanged, at `/year/:yyyy/members` — so UIE-08's four semantic tokens and its card
   treatment continue to apply to it. The warning was correct against the option that was not chosen.
3. **`requires_adr: true`, and the reason is a route rather than a screen.** Moving the default moves
   the address **five shipped acceptance criteria** are written against — CAL-06 AC-1, AC-2, AC-13,
   AC-14 and CAL-08 AC-7 — and rewording them is this ticket's, not a chore's. **Nine more were
   checked and are deliberately untouched**; both lists are in `ticket.yaml` § 1 and § 2 with
   `file:line`. `depends_on` is `[]` and was measured (§ 6).

**One thing a human may want to know before it is planned, and it is not its position.** ***THE FOUR
SUMMARY NUMBERS IN THE PICTURE HAVE NO DEFINITIONS AND THE PICTURE CANNOT SUPPLY THEM*** — its own
figures mix units, its one month with a count draws a different number of days than it states, and all
of them are already recorded as fictional against the fixtures. They are acceptance criteria written
at PLAN. The binding one is ADR-032's: **`NGÀY PTO` and `NGÀY WFH` split the year by `type`, which
INV-04's implementation is documented as never doing**, so they are a new quantity that must sum
exactly to INV-04's total.

**And the design reference is a real file — the first on this board.**
`.ai/board/tickets/CAL-10/design/year-overview-2026-09-08.jpg` is a JPEG, not a transcription. It does
**not** close MD-030: the dispatching session placed it, and no role in the loop can still do so.

***THIS TABLE IS EMPTY FOR THE FIFTH TIME.*** `UIE-08` left it for `## ARCHIVE` on 2026-09-08, and
all thirty-three tickets on the board are `DONE`. **The paragraphs below were written while it still
held that row and are left standing rather than rewritten**, on this file's convention.

***THE LOOP IS NOW WAITING ON ONE HUMAN DECISION, AND THIS SHIP IS WHAT MADE ITS COST REAL.***
[ADR-032](../registry/decisions/ADR-032-the-year-view-replaces-its-member-grid-with-twelve-month-cards.md)
is still `PROPOSED — awaiting the operator`, so the other half of the operator's *"thay đổi UI
calendar view"* request still has no row and must not get one. The row that just shipped repainted
the grid that exists today — **and if ADR-032 is accepted, that paint is thrown away rather than
adjusted.** That asymmetry was stated on the row before it was planned and is repeated here now that
it has been spent, which is the only honest place for it.

***AND THE TWO IDEA FILES THIS TICKET WAS PROMOTED FROM DID NOT SHIP WITH IT — NOR DID ADR-032.***
`.ai/board/ideas/**` and `.ai/registry/decisions/**` are *Everything else* under
`.ai/standards/git-conventions.md:140-146`, so all three stayed dirty while the `features.md` row
that cites them rode the ticket branch as ship-owned. **The pull request therefore lands a registry
row citing files that are not in the repository.** `04-review.md` § *Findings* raised it, and it is a
consequence of TRIAGE and IN_PROGRESS sharing one working tree (ADR-006) rather than a defect in the
implementation. It is item 6 below, and it is `/thuki`'s on an `ops/<slug>` branch.

**Row 1 was appended by `product` at /triage on 2026-09-08**, from
`.ai/board/ideas/2026-09-08-the-year-grid-is-the-last-calendar-surface-still-drawn-in-defaults.md`,
whose `# Triage verdict — PROMOTE, as UIE-08` section is the reasoning. **`product` asserts nothing
about its position** — it is row 1 because the table was empty, not because anybody placed it there;
the header of this file says a human reorders. **The paragraph immediately below says this table is
empty and is left standing rather than rewritten**, on this file's convention: it was true when
`CAL-09` shipped, and it stopped being true when this row landed.

**Four facts a human needs, and none of them is a priority question.**

1. ***THE OPERATOR'S REQUEST WAS SPLIT IN TWO AND ONLY HALF OF IT IS ON THIS TABLE.*** The request was
   *"thay đổi UI calendar view"* with an image of the **year** view. **This row is the repaint half** —
   four raw framework colour classes become the four semantic tokens, and one box takes
   `--radius-card` and `--shadow-soft`. **The other half has no row and must not get one yet**: the
   picture replaces the member × day heatmap with twelve month mini-calendars and a four-card summary
   band, which stops **nine shipped domain acceptance criteria** being observable — CAL-06 AC-3, AC-4,
   AC-5, AC-6, AC-8, AC-9, AC-10 and CAL-08 AC-7 and AC-11. It is
   `.ai/board/ideas/2026-09-08-the-year-view-is-the-only-screen-that-shows-who-declared-nothing.md`,
   ruled **NEEDS-ADR**, with
   [ADR-032](../registry/decisions/ADR-032-the-year-view-replaces-its-member-grid-with-twelve-month-cards.md)
   drafted in full and **`PROPOSED` — awaiting the operator**. **This is the same split, on the same
   grounds, as the month-view image's on 2026-09-07.**
2. **This row does not wait for that answer, and the cost of that is stated rather than hidden.** It
   repaints the grid that exists today and is unblocked whichever way ADR-032 goes. **But if ADR-032 is
   accepted after this ships, this work is thrown away rather than adjusted** — which is the one
   asymmetry with the UIE-06 / ADR-031 pair, where the pending change was a one-line deletion. It is on
   the ticket at § 5 and in the ADR's § *Consequences*. Folding the two together was refused for the
   reason the split exists: it would delete nine criteria inside a ticket whose stated scope is a
   palette, where the only mechanism that would notice is a person remembering to look.
3. **Much of what decides the size is already written into the screen, which is why no size is
   recorded here.** CAL-06 AC-5 turns on the `data-type` **attribute** and not on the colour, and
   `src/routes/YearView.tsx:433-437` says so in terms — *"it keeps AC-5 true when the palette is
   finally written"* — so the criterion was authored in anticipation of exactly this change. The
   tentative treatment is opacity plus an `sr-only` word rather than a border, so it survives a fill
   substitution untouched. **The size will move on one thing that is not the fills:** whether the
   repaint also takes the four default-styled cards on this screen — loading, member-less, unavailable
   and the empty-calendar sentence.
4. **`depends_on` is `[]` and it was measured.** Every ticket on the board is `DONE` and this table was
   empty, so nothing claims a path. `allowed_paths` is `[]` on every ticket. All of `feature_ids` is
   one group, so Definition of Ready item 6 passes.

**Two things a human may want to know before it is planned, and neither is its position.**

- ***THE LOAD-BEARING HALF OF THIS TICKET IS WHAT IT DOES NOT DO***, and `ticket.yaml` § 7 carries ten
  negative requirements. The four worth reading first: **no Vietnamese copy** — several of the
  picture's strings **fail the build**, not just review, because the lint rule reports diacritics in
  JSX text under `src/`, and UIE-01, UIE-05 and UIE-06 each refused the identical request; **no
  peach→mint blend**, which is a new day-level derivation in a file whose own comment forbids it
  deriving anything; **no `--color-overload` on this screen**, because that view deliberately makes no
  team read and adding one is a domain state rather than a colour; and **no shell edit at all**.
- **A finding about the image that belongs to no ticket and is now on its third showing.** Its sidebar
  draws eight members carrying five team subtitles — Core Engineering, Frontend Team, Backend Team,
  QA / Testing, Design / Product — which **contradicts INV-07 and the charter's one-team scope**. It is
  recorded at `.ai/board/tickets/UIE-05/design/README.md` § 4.1 and
  `.ai/board/tickets/UIE-06/design/README.md` § 4.1, and now at
  `.ai/board/tickets/UIE-08/design/README.md` § 4.4. **It has been shown three times and acted on
  nowhere.** The sidebar is out of scope on all three, so nothing acts on it; what is owed is that
  nobody reads those subtitles as a requirement.

***THIS TABLE IS EMPTY FOR THE FOURTH TIME.*** `CAL-09` left it for `## ARCHIVE` on 2026-09-08. All
thirty-two tickets on the board are `DONE`, and **every idea in `.ai/board/ideas/` now carries a
verdict** — the 2026-09-03 sign-in idea was the last one without, and it was ruled `REJECT` at the
same triage that produced `CAL-09`.

**Three of the four items that were owed at the last emptying are now closed.** What remains is
`/thuki`'s, plus two documents this ship found stale:

1. **`§ Colour`, `§ Type` and the `1280px` breakpoint have no standard behind them** — still bare
   `TODO(project)` stubs while `src/index.css` carries the real values. Transcription from what
   shipped, not authorship.
2. **The product shows two names** — `index.html:6` and `CLAUDE.md` say *CaleChip*; the auth card and
   the sidebar say *Ai Nghỉ?*. One string in one file whichever way it goes.
3. **`PLAN -> READY` is a loop step no command runs** — sixteen tickets old. Only BUG-002 broke the
   run, and only because the operator instructed the gate by hand.
4. ***TWO MODEL-PLANE DOCUMENTS ARE STALE, AND CAL-09 IS THE FIRST TICKET TO LEAN ON THEM TO SKIP A
   GATE COMMAND.*** `.ai/board/model-debt.md`'s **MD-021 is unresolved only because nobody marked
   it** — BUG-001 fixed it on 2026-09-03 and `playwright.config.ts:49-51` is that fix, pinning
   `VITE_DATA_SEAM: "mock"` and `VITE_SUPABASE_URL: ""`. And
   `.ai/standards/testing-standards.md:35-41` still records the end-to-end suite as *10 tests in 2
   files — 4 pass, 6 fail*, while it has run **165 then 171 passing** across the four ships since.
   Both were cited, correctly in form and wrongly in fact, as the reason not to run `playwright` on
   this ticket.

   **DONE by `steward` on 2026-09-08, and the numbers were measured rather than copied from this
   row.** MD-021 carries a `RESOLVED 2026-09-03 by BUG-001` banner in MD-015's existing form, and
   `testing-standards.md`'s table now reads the run of 2026-09-08 — typecheck 0, lint 0, unit 12
   files / 202 tests, end-to-end 171 tests in 18 spec files, all green. **The defect underneath was
   recorded as MD-029**, because marking one row does not stop the next fixed row from sitting
   unmarked: nothing connects a shipped ticket to the debt row it closes, and a stale `fail` is a
   standing permission to skip a gate command in a way a stale `pass` is not.
5. **`src/components/Sidebar.tsx:63-64`** carries the three false clauses UIE-06 corrected in
   `src/index.css`, left alone because correcting a comment there would put a shell file in
   `allowed_paths`. And **six end-to-end spec headers still carry the figure `2000`** after BUG-002
   lowered the constants to 1000.

   **Added by UIE-08's ship, 2026-09-08:** the Sidebar half is unchanged and was refused a fourth
   time — `ticket.yaml` § 7.9 kept it out of `allowed_paths` on the same reasoning UIE-06 used.

6. **Three untracked files are owed a commit that `/ship` may not make**:
   `.ai/board/ideas/2026-09-08-the-year-grid-is-the-last-calendar-surface-still-drawn-in-defaults.md`,
   `.ai/board/ideas/2026-09-08-the-year-view-is-the-only-screen-that-shows-who-declared-nothing.md`
   and
   `.ai/registry/decisions/ADR-032-the-year-view-replaces-its-member-grid-with-twelve-month-cards.md`.
   **The ADR is the one that matters** — it is the decision the operator has been asked for, and
   while it is untracked it exists on exactly one machine. **`.env.example` is untracked too and is
   NOT this ticket's**: `04-review.md` measured its mtime at 2026-09-05, three days before this
   ticket's first idea file, and `git log --all -- .env.example` is empty.


**Row 1 was appended by `product` at /triage on 2026-09-08, and it is the row item 1 of the list
below has been waiting for since BUG-002 shipped earlier the same day.** It is from
`.ai/board/ideas/2026-09-08-the-year-view-refuses-a-team-of-the-size-the-brief-targets.md`, whose
`# Verdict — PROMOTE, as CAL-09` section is the reasoning. **`product` asserts nothing about its
position** — it is row 1 because the table was empty, not because anybody placed it there; the header
of this file says a human reorders. **The paragraph immediately below says this table is empty and is
left standing rather than rewritten**, on this file's convention: it was true when `UIE-07` shipped,
and it stopped being true when this row landed — which is exactly the door it describes.

**Four facts a human needs, and none of them is a priority question.**

1. ***IT IS A CAPABILITY AND NOT A DEFECT, AND THAT WAS THE WHOLE QUESTION AT TRIAGE.*** Four places
   in this repository call this *"the ticket that follows BUG-002"*, phrasing that reads as continuing
   a defect. **BUG-002 discharged its defect completely**; what remains is a limitation the product
   was always specified to have. ADR-028's four-step test decides it: **step 1 answers no** — CAL-06
   AC-14 (`.ai/board/tickets/CAL-06/01-plan.md:203-207`) *requires* the refusal that shipped, and
   CAL-04 AC-11's gloss, CAL-05 AC-15 and the CAL-07 row's sentence are all disjunctions of the form
   *assert completeness **or** page* whose first disjunct holds. **The two contradictions that CAN be
   pointed at were tested rather than waved through, and the verdict section carries both**: the
   brief's *"View năm chịu được 30 người"* (`product_brief.md:110`) names a **member count** while the
   failure is keyed to a **row count**, and no file anywhere states entries per member; and CAL-06's
   AC-1 and AC-14 disagree above the cap, which is a clash between two criteria rather than between a
   criterion and the surface. **Step 2 then answers yes** — afterwards a team above one page can see
   its year — so `CAL`, by area. `tech-lead-design` reached the same prefix independently on the
   disjunction argument alone; the two contradictions above are `product`'s and are why that argument
   was not sufficient on its own.
2. ***THIS TICKET MAKES FOUR SHIPPED ACCEPTANCE CRITERIA VACUOUSLY TRUE, AND THAT IS DELIBERATE.***
   CAL-04 AC-11, CAL-05 AC-15, CAL-06 AC-14 and the CAL-07 row's sentence are each conditioned on the
   read *"coming back at the row limit"*. After paging that `Given` never occurs. **Paging does not
   fix them — it retires their preconditions**, and a reviewer who finds four criteria that can no
   longer fail should find this sentence first. It is also what closes the AC-1/AC-14 clash in item 1.
   **Nothing weakens CAL-06 AC-14**: anything rendering a partial year without saying it is partial
   reintroduces the defect BUG-002 closed. `ticket.yaml` § 3.
3. ***THE TICKET SHELL FENCES OFF ONE FIX SHAPE AND CARRIES ONE UNRESOLVED SCHEMA QUESTION.***
   `requires_adr: false` is scoped: **raising the Supabase project's `max-rows` API setting is out of
   bounds inside this ticket**, the same fence BUG-002 carried
   (`.ai/board/tickets/BUG-002/01-plan.md:100-103`) and more tempting here because it is the one shape
   that makes the whole ticket unnecessary. **If PLAN concludes it is the answer, the correct verdict
   from PLAN is `BLOCKED` with `requires_adr: true`**, not a quiet configuration change.
   `schema_delta: none` is correct for offset paging over the order that already exists, **and may not
   survive a keyset predicate wanting an index on `(start_date, id)`** — ADR-014 names policies,
   triggers and constraints and not indexes, so the literal reading says `none` and the literal
   reading is what ADR-014 exists to distrust. Deliberately unresolved at triage. `ticket.yaml` § 6
   and § 7.
4. **`depends_on` is `[]` and it was measured.** Every ticket on the board is `DONE` and this table
   was empty, so nothing claims a path. **`BUG-002` is deliberately not named**: it is DONE and merged
   (PR #76), so it is a predecessor in fact rather than a dependency in the field, which names
   something still to happen. All of `feature_ids` is one group, so Definition of Ready item 6 passes.
   `ticket.yaml` § 10.

**Two things a human may want to know before it is planned, and neither is its position.**

- ***THE SHIPPED PRECEDENT IS PARTIAL AND THE MISSING HALF IS THE HARD HALF.*** ADM-04's
  `listPendingEntries` (`src/lib/data/supabase.ts:1373-1433`) gives the ingredients — `count: "exact"`,
  `.range()`, and a short-page assertion that detects a lowered cap **without knowing its value**
  (`:1417-1420`). **It is not a walk.** It fetches one page whose index the caller supplies, `.range(`
  occurs exactly once in the whole seam, and there is no loop of any kind in that file — checked at
  this triage rather than recalled, correcting the technical half's description of it. A year view
  needs a **complete** result assembled from several requests, because `absenceCountsFor` must be
  handed every row before it is called. **The loop, its termination and its bound are new work with no
  precedent in this tree**, which is why the shell records no size and no size signal. `ticket.yaml`
  § 5 and § 9.
- ***NO RUNNER IN THIS REPOSITORY CAN PROVE THIS FIXES ANYTHING, AND THAT MUST BE DECLARED RATHER
  THAN GLOSSED.*** `playwright.config.ts:49-51` pins the acceptance suite to the mock, so a test
  proves the loop is *implemented*, not that it repairs a truncation the mock cannot produce; the real
  implementation's count-against-assembled check cannot fire there. `tests/pending-entries.test.ts` is
  the shipped precedent for declaring exactly that in a test header. **And the page size constrains
  the test directly** — `PENDING_PAGE_SIZE` is 50 (`src/lib/domain/types.ts:556`) because crossing a
  boundary at 1000 would mean creating 1001 entries. `ticket.yaml` § 8.

***THIS TABLE IS EMPTY FOR THE THIRD TIME.*** `UIE-07` left it for `## ARCHIVE` on 2026-09-08. All
thirty-one tickets on the board are `DONE`.

**The queue behind `/triage` is now genuinely shorter than it was at either earlier emptying**, and
that is worth saying because the first two times it was not. **Both ADRs that were waiting have been
decided** — ADR-029 `ACCEPTED by orchestrator`, ADR-031 `REJECTED` — and **the row ADR-029 obliged
has now shipped**, so that obligation is discharged rather than pending. **The `BUG` row owed since
2026-09-05 has shipped too**, as BUG-002.

**What is left is four items, none of which is a ticket yet, and only one of which is `/triage`'s:**

1. ~~**Paging for a large team's year view** — BUG-002 fix shape (c), pre-authorised by CAL-04's plan
   and ADR-015 and deliberately out of that ticket's scope. **After BUG-002 a year read that
   legitimately exceeds 1000 now REFUSES rather than silently shortening**, which is better and is
   still not a calendar. This is the one that wants `/triage`.~~
   ***DISCHARGED 2026-09-08 BY `product` AT /triage — the row is `CAL-09`, at row 1 of the table
   above.*** Struck rather than deleted, on this file's convention. Everything it states about the
   tree is still true: nothing is fixed yet, and what changed is only that the work is on the board.
   **Two corrections it needs, both established at that triage rather than inherited.** It is **not**
   a fix shape carried over from a defect — the verdict is `CAL-09`, a **capability row**, and the
   reasoning is in the idea file. And ***"pre-authorised by CAL-04's plan and ADR-015" is half
   false***: `grep -n "pag\|range("` over
   `.ai/registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md` returns
   **zero matches**, and its `:379-381` offers two **non-paging** mitigations scoped to the **holiday**
   read. **Cite `.ai/board/tickets/CAL-04/01-plan.md:176-180` and nothing else.** The same false half
   sits in `.ai/registry/features.md:102`, which is human plane under RULE-01 and `/thuki`'s to
   correct — recorded here as a finding, not fixed by this triage.
   **One further item was named at that triage and deliberately given no row**: `listTeamEntries`
   reaches the cap sooner than the year read and has no date filter at all
   (`src/lib/data/supabase.ts:1027-1034`), but `src/lib/data/index.ts:418-423` forbids it growing a
   range parameter in words, and what it actually wants is a paged **screen** like ADM-04's worklist —
   a different surface with its own criteria. **It wants its own `/triage`**, and no row was written
   for it because no idea file states that problem as its own.
2. **`§ Colour`, `§ Type` and a breakpoint have no standard behind them.** Still bare
   `TODO(project)` stubs while `src/index.css` carries the real palette and type scale, and `1280px`
   was originated at UIE-04. `/thuki`'s, on an `ops/<slug>` branch — transcription from what shipped,
   not authorship.
3. **The product shows two names** — `index.html:6` and `CLAUDE.md` say *CaleChip*; UIE-01 built the
   auth card as *Ai Nghỉ?* and UIE-02 put that string on every screen. One string in one file
   whichever way it goes, and unresolved.
4. **`PLAN -> READY` is a loop step no command runs** — now fifteen tickets old. BUG-002 is the only
   one where `gates.plan` did not reach `/ship` as `false`, and only because the operator instructed
   it by hand. `/thuki`'s.

**And two smaller things, both found by a ticket that could not fix them:**
`src/components/Sidebar.tsx:63-64` carries the same three false clauses UIE-06 corrected in
`src/index.css` — left alone because correcting a comment there would put a shell file in
`allowed_paths`, and RULE-03's guard cannot tell a comment from a rewrite. And **six end-to-end spec
headers still carry the figure `2000`** in prose after BUG-002 lowered the constants to 1000; their
load-bearing claim survives and only the numeral is stale.

**Renumbered to 1 by `orchestrator` at /ship on 2026-09-08**, when BUG-002 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering — `UIE-07` was already `depends_on: []`. **The exposure
BUG-002's position was handling is now closed rather than carried**: UIE-07 puts a second surface on
the calendar read, and that read no longer truncates in silence. The paragraph below explains why
`UIE-07` never named `BUG-002` as a dependency, and it stands.

**Row 2 was appended by `product` at /triage on 2026-09-08, later the same day, and it is the row
owed item *"ADR-029 obliges a re-triage"* below has been waiting for since that decision was
signed.** It is from `.ai/board/ideas/2026-09-07-a-day-does-not-say-how-full-it-is.md`, whose
**second** verdict section — `# Re-triage verdict — PROMOTE, as UIE-07` — is the reasoning. **That
file carries two verdicts and the live one is the second**: the `NEEDS-ADR` pass above it is
discharged history, and it is discharged in the ordinary way rather than reversed — it named a
decision that had to be made, and the decision was made.

**`product` asserts nothing about its position.** It is row 2 because `BUG-002` was already row 1
when this was written, not because anybody placed either of them. The header of this file says a
human reorders, and placing this above a row already here would have moved it.

**Four facts a human needs, and none of them is a priority question.**

1. ***THE VERDICT WAS NOT A JUDGEMENT CALL AND WAS NOT RE-DERIVED.***
   [ADR-029](../registry/decisions/ADR-029-the-week-view-renders-a-per-day-absence-count.md) is
   `ACCEPTED by orchestrator` and its § *Consequences* states it directly: *"This decision does not
   create a ticket. On acceptance the idea is re-triaged and promotes into a `UIE` row carrying the
   four clauses above as the substance of its criteria. Nothing is built from this document
   alone."* ADR-028's four-step boundary test is spent rather than re-run — the ADR names the
   group. **The operator delegated that decision rather than making it** — *"tưj quyết đi"* — so the
   signature is an agent's and **CODEOWNERS review at merge is the approval**, and ADR-008's revert
   condition points at exactly that document.
2. **`requires_adr: false`, and unusually that is a fact rather than a first reading.** The three
   artifacts that refused this number — CAL-05's row, CAL-05's `01-plan.md:95-97`, UIE-04's shipped
   AC-13 — are the envelope ADR-029 opened, so PLAN builds inside the four clauses instead of
   stopping. **If PLAN concludes it needs anything outside them** — the overload state, a team read,
   or an amendment to INV-04 — **the correct verdict is `BLOCKED` with `requires_adr: true`**.
   `ticket.yaml` § 1 and § 6.
3. **`depends_on` is `[]` and it was measured rather than assumed.** UIE-04 and UIE-05 both shipped
   the week column this row writes into and both are `DONE`, read from `ticket.yaml` rather than
   from this view (`UIE-04/ticket.yaml:13`, `UIE-05/ticket.yaml:14`), so Definition of Ready item 3
   passes. **`BUG-002` at row 1 is deliberately not named**: its scope is
   `src/lib/domain/types.ts` and both seam implementations, it touches no route, and its own § 9
   puts `src/lib/data/absence.ts` out of bounds because the defect is *upstream* of the arithmetic
   this row displays. `ticket.yaml` § 5 carries the measurement, including the honest residue —
   while `BUG-002` is unfixed the new strip **inherits** a truncation exposure CAL-05 AC-15 already
   records, and it must neither create nor fix one.
4. **The load-bearing half is a single sentence that must reach an acceptance criterion.** The
   number is `absenceCountsFor(entries, range, roster)` **and nothing else** — a `week-row` count, a
   `people.length` or any local sum is forbidden. That is ADR-029 clause 1, it is why **INV-04 is
   *satisfied* rather than amended and the ledger is not edited**, and **one occurrence of a count
   from any other source, anywhere in this product, is that ADR's revert condition**. Without the
   clause the decision becomes its own rejected option 3 — three chips against a load of two.

**Two things a human may want to know before it is planned, and neither is its position.**

- **One decision is handed to PLAN open, and it is coupled to a test.** Whether *"Everybody is in."*
  goes. A footer reading `0/4` makes deleting it defensible *and following from* the count — but
  ADR-029 authorises the ticket only to **consider** it, and **until the ticket decides, the
  sentence stays**: without the count, deleting it makes *an ordinary Tuesday* and *we did not look*
  the same column (CAL-05 AC-13, UIE-04 AC-10), and `tests/e2e/cal-05-week-view.spec.ts:266`
  asserts **seven** `week-day-empty` elements. That spec file enters `allowed_paths` if and only if
  PLAN deletes the sentence, and PLAN says which it chose. `ticket.yaml` § 4.
- **What ADR-029 says gets worse is on the row rather than hidden, and the plan does not have to
  discover it.** A day with one full-day and two half-day entries shows three chips over `1.5/N`
  and the screen does not explain the arithmetic — CAL-05's objection, **accepted rather than
  answered**, with a secondary revert condition that retires the strip on the first real report
  instead of explaining it, so PLAN must not spend a row explaining it pre-emptively. A second
  number lands on the densest screen in the product. And a refusal taken deliberately three times is
  reversed, which costs the next reader some trust in that file's standing comments —
  `src/routes/WeekView.tsx:11-17`, which this ticket rewrites and whose replacement ADR-029
  requires to carry the correction that **a count never needed a team read**.

**Row 1 was appended by `product` at /triage on 2026-09-08, and it is the row owed item 1 below has
been waiting for since 2026-09-05.** It is from
`.ai/board/ideas/2026-09-08-two-row-limits-sit-above-the-cap-they-were-written-to-stay-under.md`,
whose `## Verdict` section is the reasoning. It is row 1 because it is the only row, not because
anybody placed it — the header of this file says a human reorders, and `product` asserts nothing
about position.

**The paragraph immediately below says this table is empty. It is left standing rather than
rewritten**, on this file's own convention: it was true when `UIE-06` shipped, and it stopped being
true when this row landed — which is exactly the door it describes.

**Three things a human needs, and none of them is a priority question.**

1. **It is a defect, not a capability, so there is no new feature row and no new feature ID.**
   `BUG-nnn` is a ticket ID scheme: ADR-028:36-39 records that it appears on no prefix line, has no
   rows, and is not policed by check D1 — re-verified on disk at this triage against
   `scripts/check-docs.mjs:194-198` and `:224-225`, which today build the pattern from the four
   declared prefixes `CAL ADM TEA UIE`. What was written instead is a provenance sentence on the
   `Notes` of **CAL-03, CAL-04, CAL-05 and CAL-06**, each citing the idea file and `BUG-002`. On
   CAL-04, CAL-06 and ADM-02 the same sentence **discharges the `TODO(verify):` on the datastore's
   default `max-rows`** — the answer is 1000, read off the installed client. ADM-06's marker is a
   different and independent unknown and is deliberately **not** discharged.
2. **Four `feature_ids`, and CAL-05 is in the list on purpose.** `tech-lead-design` recommended
   three. CAL-05's AC-15 is falsified by the same constant through the same read, so it is a parent
   of this defect; that its seven-day range is unlikely to reach the cap in practice is a statement
   about urgency, not about parentage. `.ai/standards/git-conventions.md:38-39` requires a bug to
   carry its parent feature, and there are four. All four are `CAL`, so Definition of Ready item 6
   passes on one group.
3. ***THE TICKET SHELL FENCES OFF ONE FIX SHAPE AND A REVIEWER SHOULD KNOW BEFORE PLAN RUNS.***
   `requires_adr: false` is scoped to three of the four candidate fixes. The fourth — raising the
   Supabase project's `max-rows` API setting — is out of bounds inside this ticket, and `ticket.yaml`
   § 4 says why at length: it adds a repository artifact and a deployment step that do not exist, and
   it makes a product correctness property depend on a value no file records and no check can verify.
   **If PLAN concludes that shape is right, the correct verdict from PLAN is `BLOCKED` with
   `requires_adr: true`** — ADR-008's test, decide inside the envelope and ask before changing it.

***THIS TABLE IS EMPTY AGAIN — THE SECOND TIME, AND THE FIRST TIME IT HAPPENED THE ROWS CAME BACK
WITHIN THE HOUR.*** `UIE-06` left it for `## ARCHIVE` on 2026-09-08. **All twenty-nine tickets on the board are
`DONE`** — counted, not recalled — and every `CAL`, `TEA`, `ADM`, `OPS`, `BUG` and `UIE` row with them.

**What reopens the loop is unchanged and is written where it was written the first time**, under the
`## BACKLOG` heading's original empty-table paragraph further down: nothing in the loop produces work
on its own, and `/triage` is the door. **What is different this time is that the queue behind that
door is no longer hypothetical — TWO ADRs are drafted, PROPOSED, and waiting on the operator, and
they are a matched pair pointing in opposite directions:**

- **[ADR-029](../registry/decisions/ADR-029-the-week-view-renders-a-per-day-absence-count.md)** —
  the week view **gains** a per-day absence count.
- **[ADR-031](../registry/decisions/ADR-031-the-month-cell-renders-no-absence-count.md)** —
  the month cell **loses** its absence count.

**Both change an envelope rather than deciding inside one, so under ADR-008 no agent may accept
either.** And UIE-06's own plan — written after ADR-031 was drafted — records three reasons the month
count is load-bearing, without setting out to argue with it: it is what makes one-avatar-per-member
read correctly (INV-04), and it is the only surface on which a half day is expressible on that screen
at all (INV-06). That is evidence the operator has that the ADR's author did not.

***BOTH WERE DECIDED ON 2026-09-08 AND THE PARAGRAPH ABOVE IS SUPERSEDED — kept standing because it
records correctly what was true for a day, and because the pair still has to be read together.*** The
operator delegated rather than decided — *"tưj quyết đi"* — which lifted the envelope gate without
saying which way, so both carry an agent's signature and **CODEOWNERS review at merge is the
approval**:

- **ADR-029 — `ACCEPTED by orchestrator`.** The week view gains `n/N` per day column, from
  `absenceCountsFor` and no other source.
- **ADR-031 — `REJECTED by orchestrator`.** **The month cell keeps its numeral.** Option 1, which is
  what both drafting agents recommended.

**The pair resolves to: the product keeps the month count and gains a week count.** ADR-031
§ *Interaction with ADR-029* item 5 called that the cheap answer in its own words. The argument that
settled it is item 3 of the same section rather than any preference about density — ADR-029 rejects
its own option 3 because a reader who counts three chips against a load of two gets the wrong number,
and deleting the month numeral asks that cell to become exactly that.

~~**ONE THING IS NOW OWED THAT WAS NOT BEFORE: ADR-029 obliges a re-triage.** Its § *Consequences* says
*"This decision does not create a ticket"* — the idea
`2026-09-07-a-day-does-not-say-how-full-it-is.md` is re-triaged and promotes into a `UIE` row carrying
the four clauses as the substance of its criteria. **That is `/triage`'s, in a `product` session, and
it is the first row this empty table is waiting for.**~~ ADR-031's rejection obliges nothing at all.

***DISCHARGED 2026-09-08 BY `product` AT /triage — the row is `UIE-07`, at row 2 of this table.***
Struck rather than deleted, on this file's convention. **It was not the first row this table was
waiting for in the end**: `BUG-002` reached it earlier the same day, so this one is row 2, which is a
statement about arrival order and not about priority. What the re-triage produced is a `UIE-07` row in
`.ai/registry/features.md`, a shell at `.ai/board/tickets/UIE-07/ticket.yaml`, and a second verdict
section in the idea file — the `NEEDS-ADR` pass there is now discharged history and the `PROMOTE` is
live.

**And one stale comment is owed with it.** `src/routes/WeekView.tsx:11-17` still reads *"IT COUNTS
NOTHING"* and still gives the two reasons the decision found false. It belongs to the ticket, not to a
chore, so it stays wrong in the tree until that ticket runs. **That is still true and is NOT
discharged by the re-triage** — the ticket now exists and carries the rewrite as `ticket.yaml` § 3,
with ADR-029's requirement that the replacement say a count never needed a team read; the comment is
wrong in the tree until `UIE-07` is built. Re-read on disk at that triage and unchanged.

**The other four owed items are unchanged** and are listed under the original empty-table paragraph:
the `BUG` row for the 2000-against-1000 truncation limits, the `§ Colour` / `§ Type` / breakpoint
stubs, the two product names, and the `PLAN -> READY` loop step no command runs — now thirteen
tickets old.

***ONE OF THOSE FOUR IS NOW DISCHARGED, 2026-09-08: the `BUG` row exists and is `BUG-002` at row 1.***
The sentence above is left standing rather than corrected, on this file's convention. **The other
three are untouched and still owed** — ~~and so is ADR-029's obliged re-triage of
`.ai/board/ideas/2026-09-07-a-day-does-not-say-how-full-it-is.md`, which is a **separate `/triage`
run in a `product` session** and is **not** discharged by this one.~~ Nothing about `BUG-002` bears on
it: it is a defect against four shipped `CAL` rows, and the re-triage promotes into a `UIE` row.

***THE RE-TRIAGE WAS DISCHARGED LATER THE SAME DAY, 2026-09-08, and the clause above is struck rather
than deleted.*** It was correct when written — that separate `product` session was still owed, and it
then ran. Its outcome is `UIE-07` at row 2. **The three remaining owed items are unchanged and still
owed**: the `§ Colour` / `§ Type` / breakpoint stubs, the two product names, and the `PLAN -> READY`
loop step no command runs. **The `src/routes/WeekView.tsx:11-17` comment is also still stale**, and
what changed is only that a ticket now carries its rewrite.

**One smaller item was added by this ship.** `src/components/Sidebar.tsx:63-64` carries a comment
whose three clauses are false, the same ones UIE-06 corrected in `src/index.css`. It was left in place
deliberately: correcting it would have put a shell file in `allowed_paths`, and RULE-03's guard cannot
tell a comment from a rewrite.

**Renumbered to 1 by `orchestrator` at /ship on 2026-09-08**, when UIE-05 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering — `UIE-06` was already `depends_on: []` and blocked on
nothing, so nothing was unblocked by this ship. One row left.

**THE THREE ROWS ABOVE MET AT A MERGE, AND THE NUMBERS MOVED — NOTHING ELSE DID.** `OPS-004` and the
two `UIE` rows were each written into an EMPTY table, on branches that did not see one another, so
both sides produced a row 1. `OPS-004` reached `main` first (PR #68) and keeps the number it landed
with; `UIE-05` and `UIE-06` were rows 1 and 2 on their branch and are now 2 and 3. **That is an
artefact of two branches, not a statement about priority** — the header says a human reorders, and
none of the three paragraphs below was rewritten to match its row's new number. Read each one
against the ticket it names rather than the digit it opens with.
**Row 1 was appended by `product` at /triage on 2026-09-07, and it is the row the paragraph
immediately below was waiting for.** That paragraph says this table is empty and is **left standing
rather than rewritten** — it was true when `UIE-04` shipped and it stopped being true when this row
landed, which is exactly the door it describes: `/triage` turned a request into an idea and the idea
produced a shell. `product` asserts nothing about position, on the same stance every paragraph in this
file takes; it is row 1 because it is the only row, not because anybody placed it. It is from
`.ai/board/ideas/2026-09-07-a-new-project-admits-nobody-and-has-no-way-in.md`, whose *Triage verdict*
and *Re-triage verdict* sections are the reasoning.

**Four facts a human needs, and the first is not a priority question.**

1. ***THE VERDICT WAS `NEEDS-ADR`, NOT `PROMOTE`, AND ONLY HALF OF IT IS ON THIS TABLE.*** The idea
   split into two decisions that were deliberately not bundled. **This row is the first**: the
   first-admin deadlock, answered by a password-free bootstrap SQL file, `ACCEPTED by
   tech-lead-design` under ADR-008 as
   [ADR-030](../registry/decisions/ADR-030-the-first-admin-arrives-by-a-password-free-bootstrap-file.md)
   because it supersedes nothing — it is ADR-009's own recorded exit, made runnable after ADR-024
   closed the file that used to carry it. **The second has no row and must not get one**: the attached
   image's `YÊU CẦU ĐĂNG KÝ MỚI` sign-up approval queue reverses ADR-009 decision points 1 and 3,
   which carry `ACCEPTED by the operator`, so it stopped and went back as one question that is
   **unanswered**. It is (a) the bootstrap file only, (b) the bootstrap now and the queue as its own
   later ADR, or (c) both together — reproduced in full in the idea's verdict section.
2. **This row does not wait for that answer, and that is the load-bearing part.** It is unblocked
   under **all three** of (a), (b) and (c), because somebody has to be the first admin in every one of
   them: a queue whose approve action inserts a `member` row still needs an admin to press it, and one
   that files allow-list rows still needs an admin whose id goes in `added_by`. Answering the question
   neither unblocks this row nor invalidates it.
3. **`depends_on` is `[]` and it was measured rather than inherited.** Every ticket on this board is
   `DONE` and this table was empty, so no live ticket claims a path. **Appendix A of
   `.ai/board/tickets/TEA-01/02-design.md:840` — the disposable-test-database chore — is NOT a
   prerequisite**, measured: while it is unlanded the Supabase SQL editor is the only surface
   available on a hosted project, and that is precisely the surface this file is applied through.
   Landing it would give this ticket somewhere to rehearse, which is a convenience. It also has no
   ticket and no ID, so it could not go in that field in any case. `ticket.yaml` §6.
4. **It is a chore, so no new feature row was written** — a deliberate departure from ADR-007's
   PROMOTE default, the same one BUG-001, OPS-001 and OPS-002 took, and **unlike `UIE-01`, whose
   version of this argument ADR-028 overruled by declaring a feature group**. There is no group for
   operational bootstrap procedures and declaring one is an ADR and the operator's. The provenance is
   one sentence appended to the `Notes` of `TEA-01` in `.ai/registry/features.md`, and nothing else.
   **That row's `TODO(project)` is deliberately NOT marked closed**: it closes when the file reaches
   `main`, not when a ticket points at it.

**Two things a human may want to settle before it is planned, and neither is its position.**

- **`.ai/standards/data-model.md` § *Seed data* will be one file out of date the moment this ships,
  and this ticket may not fix it.** That file is human plane under RULE-01, so the paragraph
  distinguishing the bootstrap file from the two things already described there belongs to `/thuki`
  on an `ops/<slug>` branch. **It is the third item now waiting on that session**, beside § *Colour* /
  § *Type* and the `PLAN -> READY` gap named below. `ticket.yaml` §8.
- **`supabase/db.sql` § 9.1 and § 9.2 are stale**, found during this triage and out of scope here:
  they say `public.team` has no select policy and no update policy, while
  `20260904100000_cal04_team_select.sql` and `20260905000000_adm01_team_threshold.sql` both shipped.
  Under ADR-026 that file is the target schema and is applied by hand to stand up a fresh project, so
  a reader following § 9 will believe two screens are broken that are not. **It has no row**, and it
  sits in the file whoever applies this ticket's bootstrap will be standing next to.
**Row 2 was appended by `product` at /triage on 2026-09-07, later the same day, and `product` asserts
nothing about its position.** Same stance as every paragraph in this file: the header says a human
reorders, so placing it above row 1 would have moved a row that was already here. Nothing was
renumbered and no row moved relative to another.

It is from
`.ai/board/ideas/2026-09-07-the-month-grid-is-the-only-calendar-surface-still-drawn-in-defaults.md`;
that file's *Triage verdict* section is the reasoning, and
`.ai/board/tickets/UIE-06/design/README.md` is the visual reference — **a hand transcription of the
operator's second image of the day, shown in conversation and never on disk, and a different image
again from UIE-05's and from the one UIE-02, UIE-03 and UIE-04 were built against.**

**Four facts a human needs, and none of them is a priority question.**

1. **`depends_on` is `[]` and Definition of Ready item 3 passes today.** UIE-01 through UIE-04 are
   DONE. **UIE-05 is deliberately not named**: it owns `src/routes/WeekView.tsx` and this row owns
   `src/routes/MonthView.tsx`, which are disjoint, and `allowed_paths` is `[]` on every ticket on the
   board so nothing claims a path. **The one file that could collide is `src/index.css`** if both
   tickets add a token, and both shells record that neither expects to. One working directory holds
   one branch (ADR-006), so only one is ever in flight regardless.
2. **This idea was cut in two at triage as well, and the other half is not a ticket.** The picture
   **deletes the per-cell absence count** — `month-cell-count` — and that is a domain amendment rather
   than a restyle: CAL-04 AC-3 states INV-04's formula in words, and `CAL-04/01-plan.md:192` grants the
   Tech Lead the count's *position* while saying nothing about its *presence*. It went to
   `.ai/board/ideas/2026-09-07-the-month-cell-number-is-what-stops-the-avatars-being-counted.md` on a
   **NEEDS-ADR** verdict, with
   [ADR-031](../registry/decisions/ADR-031-the-month-cell-renders-no-absence-count.md) drafted in full
   and **`PROPOSED` — awaiting the operator**. **This row does not wait on that decision** and ships a
   month grid matching the picture minus one small numeral per busy cell.
3. **Much of the picture is already on screen**, which is the finding most likely to move this
   ticket's size and is why no size is recorded here — the day numeral, the avatar chips and their two
   colours, the overloaded day's whole-cell pink, Monday-first whole weeks and greyed out-of-month
   days are all shipped. **What is genuinely missing is the full-pane width, the ruled single card,
   the cell height, the weekday strip's position, the out-of-month tint and the badge's slot.** The
   size will move on one thing that is not in that list: whether the plan also converts the grid onto
   UIE-01's and UIE-02's tokens, which it uses none of today.
4. **The load-bearing half of this ticket is what it does *not* do**, and `ticket.yaml` § 7 carries it
   as ten negative requirements. The four worth reading before planning: **no Vietnamese copy** —
   `CẦU` fails the build, not just review, because `eslint.config.js:84-92` lints JSX text for
   diacritics and `Ầ` is U+1EA6; **`month-cell-count` and `month-threshold` both stay**; **the bridge
   badge is not filled**, because pink is the overload colour and filling it paints a crowded-day
   signal onto a working day; and **no shell edit at all**.

**Two things a human may want to settle before it is planned, and neither is its position.**

- **ADR-029 and ADR-030 are now both on the desk, from two pictures by the same person on the same
  day, and neither is readable alone.** One adds a per-day absence count to the week view; the other
  removes it from the month view. **Neither violates INV-04** — the invariant governs the number's
  definition, not where it is rendered — but ADR-029 argues for itself by saying the week strip
  *"provably agrees with the month grid"*, and ADR-031 removes the surface that agreement was ever
  visible on. Both documents carry the interaction in a section of its own, so whichever is opened
  first says so. **They are two signatures, not one.**
- **`src/index.css:141-143` and `src/components/Sidebar.tsx:62-65` state something that is not true**
  — that no calendar view computes an overload state and that `seam.getTeam()` is not called by any of
  them. `MonthView.tsx:175` calls it and `:347` computes `isOverloaded`, and has since CAL-04 shipped
  the day before those comments were written; verified independently against source at this triage.
  **It is the recorded reason the sidebar has no overload legend row — the row both images draw.**
  Correcting the comments is two lines; building the row is a shell change nobody has scoped.

**Row 1 was appended by `product` at /triage on 2026-09-07, and `product` asserts nothing about its
position — it is row 1 because the table was empty, not because anyone placed it there.** The
paragraph immediately below said this table was empty and it was true for a few hours; it is left
standing rather than rewritten, on the same convention every corrected-in-place paragraph in this file
follows. **The door it names is the door that was used**: `/triage` turned a request into an idea and,
on a PROMOTE verdict, wrote the shell that became this row.

It is from
`.ai/board/ideas/2026-09-07-a-busy-week-does-not-fit-and-a-day-does-not-say-how-full-it-is.md`; that
file's *Triage verdict* section is the reasoning, and `.ai/board/tickets/UIE-05/design/README.md` is
the visual reference — **a hand transcription of an image shown in conversation and never on disk, and
a different image from the one UIE-02, UIE-03 and UIE-04 were built against.**

**Four facts a human needs, and none of them is a priority question.**

1. **`depends_on` is `[]` and Definition of Ready item 3 passes today — the first row in this group
   for which that is true.** UIE-01 through UIE-04 are all DONE, so the chain this screen sits on is
   complete. Nothing on the board claims a path, because nothing else is on the board.
2. **The idea it came from was cut in two at triage, and the other half is not a ticket.** The image's
   per-day footer count — `n/8 vắng` — went to
   `.ai/board/ideas/2026-09-07-a-day-does-not-say-how-full-it-is.md` on a **NEEDS-ADR** verdict, with
   [ADR-029](../registry/decisions/ADR-029-the-week-view-renders-a-per-day-absence-count.md) drafted
   in full and **`PROPOSED` — awaiting the operator**. **This row does not wait on that decision**; it
   ships a screen matching the picture minus one strip along the bottom of each column. **The two were
   split rather than folded** because a count on this screen reverses CAL-05's registry row and
   UIE-04's shipped AC-13, and folding it into a restyle would have reversed three deliberate refusals
   somewhere nobody reviews them.
3. **Roughly half of what the image asks for is already on screen**, which is the finding most likely
   to change this ticket's size and is why no size is recorded here. The seven columns are already
   exactly equal in height; what is missing is that a column *fills* the viewport on a quiet week, and
   the answer is `min-height` rather than `height` — which is what lets UIE-04's AC-4 and AC-5 survive
   while its § 4.2 prose is reversed. `ticket.yaml` § 2 and § 3.1.
4. **The load-bearing half of this ticket is what it does *not* do**, and it is four negative
   requirements: no Vietnamese copy, no footer count, none of the chip's five facts deleted, and no
   shell edit. `ticket.yaml` § 7 carries them. **`week-day-empty` keeps its sentence** — its deletion
   is coupled to the footer count and is decided with it or not at all.

**One thing a human may want to settle before it is planned, and it is not its position.** ADR-029 is
the only ADR in this repository that an agent has drafted and refused to accept. It reverses a refusal
that CAL-05's row, CAL-05's plan and UIE-04's AC-13 each took deliberately, which is changing the
envelope rather than deciding inside it (ADR-008) — so the status may only ever read
`ACCEPTED by the operator` or `REJECTED`. **Two of the three reasons behind the standing refusal do
not survive being checked**, and that is true whichever way the operator decides: `absenceCountsFor`
is the one definition and needs no team read, so `src/routes/WeekView.tsx:11-17` owes a correction
even under a `REJECTED`.

***THIS TABLE IS EMPTY, AND IT IS THE FIRST TIME.*** `UIE-04` left it for `## ARCHIVE` on
2026-09-07, and with it the last of the twenty-six rows this board has carried. Every `CAL`, `TEA`,
`ADM`, `OPS`, `BUG` and `UIE` ticket is DONE.

**Nothing in this file describes this state, and nothing in the loop produces work on its own.**
`/next-ticket` reads an empty table and has nothing to report; `/plan` has no ID to take. **The loop
does not restart until a human puts a row here**, and the door back in is `/triage` — which turns a
request into an idea under `.ai/board/ideas/` and, on a PROMOTE verdict, writes the shell that
becomes row 1.

**Three things are already written down and waiting for that door, none of them invented here.**
Each is recorded in the file that found it, and each is the operator's to promote or to decline:

1. **A `BUG` row is owed and nothing issues it automatically** — the paragraph below, from ADM-04's
   ship, is unchanged and unactioned. `TEAM_ENTRY_LIMIT` and `MONTH_ENTRY_LIMIT` are 2000 in
   `src/lib/domain/types.ts` while the datastore caps at 1000, so their truncation assertions can
   never fire and **CAL-04 AC-11 is not held**: the month grid sums what it was given and shows a
   wrong count with no error anywhere.
   ***DISCHARGED 2026-09-08 BY `product` AT /triage — the row is `BUG-002`, at the top of this
   file.*** The item is left standing rather than deleted, and everything it states is still true of
   the tree: nothing is fixed yet, and what changed is only that the work is now on the board. It
   grew in the doing — it is **four** unheld written statements against four `CAL` rows, not one, and
   CAL-03's is the sharpest because `listTeamEntries` has no date filter at all.
2. **`§ Colour`, `§ Type` and a breakpoint have no standard behind them.** `.ai/standards/ui-design-system.md`
   § *Colour* and § *Type* are still bare `TODO(project)` stubs while `src/index.css` carries the
   real palette and type scale (UIE-01), and `1280px` was originated at UIE-04 as the product's
   first breakpoint. Writing those sections **from what shipped** is `/thuki`'s on an `ops/<slug>`
   branch — transcription, not authorship — and it is human plane under RULE-01 either way.
3. **The product shows two names.** `index.html:6` and `CLAUDE.md` say *CaleChip*; UIE-01 built the
   auth card as *Ai Nghỉ?* and UIE-02 put that string on every screen. It is one string in one file
   whichever way it goes, and it is unresolved.

**One model defect is also owed a row and has never had one.** Ten consecutive tickets recorded that
`PLAN -> READY` is a loop step (`.ai/01-operating-model.md:285`) that **no command runs** —
`/next-ticket` grades the Definition of Ready and writes no file by design, `/ship` transcribes both
gates at the end, and in between `state` and `gates.plan` sit stale on every ticket. Six shells blamed
a different owner for it, which is a good reason it was never fixed. That is `/thuki`'s.

**Renumbered to 1 by `orchestrator` at /ship on 2026-09-07**, when UIE-03 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **`UIE-04`'s `Blocked on` is cleared in the same write**,
because it named `UIE-03` and `UIE-03` is now DONE.

***ONE ROW LEFT ON THE WHOLE BOARD.*** Every `CAL`, `TEA`, `ADM` and `OPS` row has shipped and three
of the four `UIE` rows with them. `UIE-04` is the last link of the chain triage cut on 2026-09-05,
and after it this table is empty — **which is a state nothing in this file describes, and it is worth
a human deciding what happens then rather than discovering it at a `/next-ticket` that has nothing to
report.**

**Renumbered to 1–2 by `orchestrator` at /ship on 2026-09-07**, when UIE-02 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **`UIE-03`'s `Blocked on` is cleared in the same write**,
because it named `UIE-02` and `UIE-02` is now DONE. Two rows left on the whole board, and they are the
last two links of one chain: `UIE-03` is row 1 and blocked on nothing, `UIE-04` waits on it.

**Renumbered to 1–3 by `orchestrator` at /ship on 2026-09-07**, when UIE-01 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering — no row moved relative to another. **`UIE-02`'s
`Blocked on` is cleared in the same write**, because it named `UIE-01` and `UIE-01` is now DONE. It
is row 1 and blocked on nothing; rows 2 and 3 are the rest of the chain, each waiting on the one
above it.

**Three rows are all that is left on this board.** Every `CAL`, `TEA`, `ADM` and `OPS` row has
shipped, and what remains is one idea cut into four at triage, of which the first is now built.

**Renumbered to 1–4 by `orchestrator` at /ship on 2026-09-07**, when OPS-002 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering — no row moved relative to another. **The board is now
the UIE chain and nothing else.** Every `CAL`, `TEA`, `ADM` and `OPS` row has shipped, `UIE-01` at
row 1 is blocked on nothing, and rows 2, 3 and 4 are the rest of that chain, each waiting on the one
above it. One working directory holds one branch (ADR-006), so exactly one of the four is ever in
flight and the order is enforced by git rather than by policy.

**OPS-002 spent its whole life reading `BACKLOG` in this table**, exactly as the paragraph below
predicted when ADM-06 shipped: this column is written by `/ship` and by nothing else, so a ticket
planned, built and reviewed between two ships is stale here for that entire span. `/next-ticket` read
`ticket.yaml` over the view on both of its runs, which is what the header requires of it.

**Renumbered to 1–5 by `orchestrator` at /ship on 2026-09-06**, when ADM-06 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **The ADM group is empty and the board is now one
translation row and the four-row UIE chain** — six admin rows shipped, and `OPS-002` at row 1 is
blocked on nothing and has been since 2026-09-03. `UIE-01` at row 2 is also unblocked; rows 3, 4 and
5 are the rest of that chain and each waits on the one above it.

**This row spent its whole life at `BACKLOG` in this table while `ticket.yaml` moved it to `REVIEW`,
and `/next-ticket` on 2026-09-06 read the disagreement rather than the view.** The `State` column
here is written by `/ship` and by nothing else, so a ticket that is planned, built and reviewed
between two ships is stale in this file for that entire span. It is not a defect in this row; it is
what a view that has one writer at the end of the loop necessarily looks like from the middle of it.

**Renumbered to 1–7 by `orchestrator` at /ship on 2026-09-05**, when ADM-04 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **ADM-05 is now row 1 and is unblocked** — its
`Blocked on` names ADM-04, which just shipped, and CAL-02, DONE since 2026-09-03. The ADM chain is
down to its last two links, and ADM-05 is where the decision itself arrives: ADM-04 shipped the
worklist with **no approve control and no reject control**, which its registry row required.

**A `BUG` row is owed and nothing on this board issues one automatically.** ADM-04's PLAN answered
the `TODO(verify):` four tickets had been carrying — the datastore's default cap is **1000 rows**,
read off the installed client's own d.ts rather than recalled — and two shipped constants sit above
it. `TEAM_ENTRY_LIMIT` and `MONTH_ENTRY_LIMIT` are both 2000 in `src/lib/domain/types.ts`, so their
`rows.length >= 2000` truncation assertions can never fire: the server caps at 1000 and returns a
believable short list. **CAL-04 AC-11 is the acceptance criterion that is not held** — the month
grid sums what it was given and shows a wrong count with no error anywhere. `HOLIDAY_LIMIT` is 1000,
exactly equal, and survives only because the comparison is `>=`. PLAN recorded it rather than fixing
it, correctly: changing two numbers inside a ticket whose `invariants_touched` is `[]` would
silently alter two other tickets' criteria. `/triage` issues the row, and the cap is per-project
configurable, so the fix is a decision about which number moves.

**Renumbered to 1–4 by `orchestrator` at /ship on 2026-09-05**, when CAL-08 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **The CAL group is empty and every remaining row is
ADM or OPS** — eight calendar rows shipped, and ADM-04 at row 1 is unblocked: its `Blocked on`
names CAL-01, TEA-03 and ADM-01, all DONE. Rows 1, 2 and 3 are a chain (ADM-04 → ADM-05 → ADM-06)
whose head is free, and OPS-002 at row 4 is blocked on nothing and has been since 2026-09-03.

**ADM-04's registry row carries two `TODO(project):` markers that decide what its list contains**,
and they are the operator's in the same way CAL-08's bridge-day definition was — whether a WFH entry
goes through approval at all, and what happens to a pending entry whose date has passed
(`features.md:106`). Unlike CAL-08's, no ADR says these must not become a blocked gate. Recorded
here rather than left for PLAN to rediscover.

**Rows 5 to 8 were appended after that renumbering**, by `product` at /triage on 2026-09-05 and on the rebase onto CAL-08's merge. The paragraph above describes the table as it stood at that ship, so its *every remaining row is ADM or OPS* is true of rows 1 to 4 and was not made false retroactively.

**Rows 6, 7 and 8 were appended by `product` at /triage on 2026-09-05, and `product` asserts nothing
about their position.** Same stance as every paragraph in this file: the header says a human
reorders, so placing any of them higher would have moved rows a human placed. Nothing was renumbered
and no row moved relative to another. They are from
`.ai/board/ideas/2026-09-05-the-product-has-no-shell-and-every-screen-starts-over.md`; the *Triage
verdict* section of that file is the reasoning, and
`.ai/board/tickets/UIE-02/design/README.md` is the visual reference for all three — one transcription,
cited by the other two, because no image was ever on disk.

**Three facts a human needs in order to place them, and the first is not a priority question.**

1. **They are one idea cut into three, and the order is fixed rather than preferred:**
   `UIE-01` → `UIE-02` → `UIE-03` → `UIE-04`. `depends_on` names only the immediate link in each
   shell. **All three fail Definition of Ready item 3 today, on purpose** — item 3 requires every
   named ticket to be DONE and none of them is, `UIE-01` included. One working directory holds one
   branch (ADR-006), so exactly one of the four is ever in flight and the chain is enforced by git
   rather than by policy. Placing `UIE-04` above `UIE-02` would not make it buildable.
2. **The cut was made at triage so that PLAN never has to make it.** The whole mockup is nineteen
   files, which `.ai/01-operating-model.md:374` sizes as L, and L must split at PLAN. The cut is by
   surface, and each of the three leaves an application that renders and can be exercised end to
   end. **`UIE-02` deliberately ends with the application looking doubled** — a shell top bar above
   each screen's own header — because that is what buys it zero spec files; `UIE-03` is where the
   doubling ends and is the only one of the three that touches a test file.
3. **`UIE-04` carries a decision nobody has taken, and it is not a layout one.** The mockup's
   per-column footer reads `0/8 vắng`, and `src/routes/WeekView.tsx:11-17` records that this screen
   counts nothing — deliberately, because CAL-05's registry row says so and a second count is the
   second definition INV-04 exists to forbid. Reproducing that footer, or the overload row in the
   sidebar legend, needs an amendment to a feature row rather than an acceptance criterion.
   **If PLAN concludes it needs one, it stops and asks.** `ticket.yaml` § 4 carries it.
   **Re-read in the rebased file on 2026-09-05 rather than assumed** — the citation read `:11-16`
   before CAL-08 rewrote that file, and the paragraph survives it: `:11` still opens *"IT COUNTS
   NOTHING"* and `seam.getTeam()` is still deliberately not called.

**A fourth piece of the mockup was deliberately not promoted and has no row anywhere:** `Duyệt phép`,
~~the `Ngày lễ` legend row,~~ the palette icon and the `?` button. Each points at something that does
not exist — ADM-04, ADM-05 and ADM-06 for the first, and a question nobody has answered in either
direction for the other two. A row will be written when there is something for it to point at; a
promoted feature with nothing to build is worse than no row. The idea file's *Triage verdict* section
is the record of the deferral.

**The `Ngày lễ` legend row left that piece on 2026-09-05, later the same day, and is struck above
rather than deleted.** `CAL-08` merged in PR #56 and is `DONE`, so holidays are now drawn in all three
calendar views. The deferral's argument was *a legend row for a colour that never appears beside it is
a legend that lies*; **the colour now appears**, and the file the deferral cited says the reverse of
what was quoted from it (`src/routes/WeekView.tsx:28`). The row moved into `UIE-02`'s scope — that
ticket builds the sidebar — and **no new row was created anywhere**, because the ticket that brings
the control already existed. `.ai/board/tickets/UIE-02/ticket.yaml` § 9.3 carries the withdrawal.
**Nothing else moved with it:** the overload row was never part of this piece and is untouched, since
`CAL-08` brought a colour for holidays and no threshold, no team read and no overload state.

**Two other things the rebase changed, both worth a human's attention before any of the three is
planned.** **`UIE-03` grew:** it now edits **six** spec files, not five — `CAL-08` shipped
`tests/e2e/cal-08-holiday-shading.spec.ts`, which addresses two of the four `data-testid` names that
ticket deletes. **And every line citation into `WeekView.tsx`, `MonthView.tsx` and `YearView.tsx` in
all four `UIE` shells was stale by 28–35 lines and has been re-measured**; they did not move by a
uniform offset. `Holidays.tsx` and `App.tsx` were untouched by `CAL-08` and their citations stand.

**One thing a human may want to settle before any of the three is planned, and it is not their
position.** `UIE-04` § 3 finds that the mockup's seven fill-the-viewport columns **overflow by sixty
per cent** in the worst realistic week — ~168px per column, 90–110px per entry chip, and up to
sixteen chips on one day because a member may hold a morning and an afternoon entry on the same date.
The image shows an empty week, which is the one case that proves nothing. Three answers are
enumerated in that shell with a recommendation; PLAN chooses one and writes an acceptance criterion
against it, and *"looks like the screenshot"* is not available to it.

**Row 5 was appended by `product` at /triage on 2026-09-05, and `product` asserts nothing about its
position.** Same stance as every paragraph below: this file's header says a human reorders, so placing
the row higher would have moved five rows a human placed. Nothing was renumbered and no row moved
relative to another. It is from
`.ai/board/ideas/2026-09-05-the-first-screen-does-not-look-like-the-product.md`; the *Triage verdict*
section of that file is the reasoning, and `.ai/board/tickets/UIE-01/design/README.md` is its visual
reference.

**It was appended as `OPS-003` and is now `UIE-01`, changed by `product` on 2026-09-05 in the same
day.** Not a reordering and not a second ticket: the operator instructed that UI-enhancement work get
a feature group of its own, [ADR-028](../registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md)
declared `UIE` and recorded the instruction verbatim, and the ticket was renumbered into it with a
row of its own in `.ai/registry/features.md`. Its position, its title, its `depends_on` and its scope
are untouched.

**Three facts a human needs in order to place it.**

1. **`depends_on` is `[]`, and it was measured rather than inherited.** OPS-001 is `DONE` so its claim
   on `src/App.tsx`, `src/routes/SignIn.tsx` and `src/routes/SignUp.tsx` is released; OPS-002's five
   scope files are the entry screens and the two seam implementations, which are disjoint; and all
   ~~five~~ `BACKLOG` shells — ~~CAL-08,~~ ADM-04, ADM-05, ADM-06 and OPS-002 — carry
   `allowed_paths: []`, so **no live ticket claims a path at all**. That is a measurement taken on
   2026-09-05, not a standing guarantee: `src/App.tsx` has appeared in the `allowed_paths` of nine
   shipped tickets, and whichever row is planned next will fill its own. `ticket.yaml` §6 says to
   re-check at PLAN. **`CAL-08` struck from that list later the same day**, when it merged in PR #56
   and became `DONE`. **That is the thing this paragraph warned about actually happening, and it
   landed on the side that costs `UIE-01` nothing:** the paths it claimed were the three calendar
   views and `src/lib/data/`, none of which is in `UIE-01`'s scope. `depends_on: []` still holds,
   measured again rather than assumed.
2. ~~**It is a chore, so no new feature row was written** — a deliberate departure from ADR-007's
   PROMOTE default, the same one BUG-001 and OPS-002 took. The provenance is one sentence appended to
   the `Notes` of `TEA-01` and `TEA-05` in `.ai/registry/features.md`, and nothing else.~~
   **Overruled on 2026-09-05 and struck rather than deleted.** The BUG-001 and OPS-002 precedent does
   not carry here: ADR-028 gives visual work its own feature group, so **there is a row** — `UIE-01`
   in `.ai/registry/features.md`, `Status: PLANNED`, citing the idea file, which is the provenance
   ADR-007 asks of every promoted row. The two sentences on `TEA-01` and `TEA-05` are kept, marked as
   overruled, and now point at that row. Nothing about the work changed.
3. **What it does *not* do is the load-bearing half.** Vietnamese copy, username identity and the
   printed credential footer are all in the reference and all **out of scope**, each because it
   reverses a decision already taken — § *Language*, ADR-009/ADR-005, and TEA-05 AC-2 respectively.
   The avatar picker stays. `ticket.yaml` §4 carries them as negative requirements.

**One thing a human may want to settle before it is planned, and it is not its position.**
`.ai/standards/ui-design-system.md:17-24` — § *Colour* and § *Type* — are both bare `TODO(project)`
stubs, and that file is human plane under RULE-01. This ticket writes the first palette and the first
type scale the real application has had, into `src/index.css`. **If nobody fills § Colour, it becomes
the de-facto design system with no document behind it.** It is buildable either way; the cost is that
the next screen has nothing to conform to.

**Its branch is `feat/UIE-01`, and it costs nothing to argue for.** `.ai/standards/git-conventions.md:36`
asks for `feat/<FEATURE-ID>`, and `UIE-01` **is** a row in `.ai/registry/features.md` as of
2026-09-05 — so this is simply the convention followed, and the guard runs as a consequence rather
than as the reason. **The debt recorded for OPS-001 and OPS-002 four paragraphs below is discharged
for this ticket and for no other**: those two, and `feat/BUG-001`, take a `feat/` name for an ID that
has no feature row, because `scripts/check-allowed-paths.mjs:96` exits 0 with *"nothing to check"* on
any branch not beginning `feat/` and the alternative was RULE-03 unenforced across shipped
application files. That trade-off was settled by the operator on 2026-09-03; it is not reopened, and
it no longer applies here.

**Renumbered to 1–5 by `orchestrator` at /ship on 2026-09-05**, when ADM-03 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **CAL-08 is now row 1 and every one of its four names is
DONE** — ADM-02, CAL-04, CAL-05 and CAL-06. It is the row the holiday work was built for: ADM-02 made
the calendar exist, ADM-03 made it editable, and CAL-08 is where it finally appears in the three
views a person actually looks at.

**Renumbered to 1–6 by `orchestrator` at /ship on 2026-09-05**, when ADM-02 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **ADM-02 unblocked two rows at once by shipping** —
ADM-03 at row 1 and CAL-08 at row 2 both named it, and CAL-08's other three names (CAL-04, CAL-05,
CAL-06) are all DONE. So rows 1 and 2 are both free, and a human choosing between them is choosing
between the write path on the calendar and the calendar appearing in the three views.

**Renumbered to 1–7 by `orchestrator` at /ship on 2026-09-05**, when CAL-07 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **ADM-02 is now row 1 and is blocked on nothing** — its
`Blocked on` names TEA-01 and ADM-01, both DONE.

**Read `.ai/standards/data-model.md` OPEN QUESTIONS item 1 before planning ADM-02.** CAL-04's
registry row kept holiday shading deliberately out of scope because that open question *"blocks the
first story touching `holiday`"*, and ADM-02 is that story. It is the first row in months to reach
position 1 carrying a known, named precondition that is not a ticket dependency — so `depends_on`
will not surface it and DoR will not grade it, exactly like the pull-request precondition OPS-001 and
OPS-002 carried.

**Renumbered to 1–8 by `orchestrator` at /ship on 2026-09-05**, when ADM-01 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **CAL-07 is now row 1 and is blocked on nothing** — its
`Blocked on` names CAL-01 and CAL-04, both DONE. **ADM-02 at row 2 is also unblocked for the first
time**: its `Blocked on` names ADM-01, which is what just shipped, so the holiday calendar is
reachable — and rows 2, 3 and 4 are a chain that now has its head free.

**OPS-001 shipped from row 12 while CAL-04 sat at row 1, and the rows above it did not move.**
Recorded because this file's header reserves reordering to a human and says the orchestrator takes
the top — so this ship did not follow the order, and nothing in the table shows it. Only OPS-002
renumbered, 13 to 12, which is the ordinary bookkeeping when a row leaves. **CAL-04 is still row 1
and is still the top of this list.** If OPS-001 was meant to come first, the row a human moves is
the one that records it; if it was not, the order is intact and this paragraph is the only trace.

**Renumbered again to 1–11 by `orchestrator` at /ship on 2026-09-03**, when CAL-03 left this table
for `## ARCHIVE`. Bookkeeping, not a reordering. **CAL-04 is now row 1**, and it is the first row in
months whose `Blocked on` was never CAL-01 alone — it names TEA-03 too, and both are DONE.

**BOTH PRECONDITIONS BELOW ARE NOW DISCHARGED — `Blocked on` repaired to `—` by `orchestrator` on
2026-09-03.** PR #37 merged as `3424f89`, so `§ Language` is on `main` and both tickets are valid
rather than hypothetical; CAL-03 shipped as PR #38 and its row is in `## ARCHIVE`, so the file
collision that produced `depends_on: [CAL-03]` is gone. **Neither ticket is blocked on anything.**
The three paragraphs below are left exactly as `product` wrote them, because they are the record of
what the dependency was and why — and the first of them is the only place the pull-request
precondition is written down at all.

**OPS-001 and OPS-002 were appended at rows 12 and 13 by `product` at /triage on 2026-09-03, and
`product` asserts nothing about their position.** Same stance as the TEA-05 and BUG-001 paragraphs
below: this file's header says a human reorders, so placing either row higher would have moved eleven
rows a human placed. Nothing was renumbered and no row moved relative to another. They are from
`.ai/board/ideas/2026-09-03-the-interface-and-its-standard-speak-different-languages.md`; the verdict
section of that file is the reasoning.

**Three facts a human needs in order to place them, and the first one is not a priority question.**

1. **`Blocked on` names a pull request, and no ticket field can carry that.** Both tickets exist to
   satisfy `§ Language` in `.ai/standards/ui-design-system.md`, which lives in exactly one commit —
   `3ccbd37`, the sole commit of `ops/ui-language-english`, **open as PR #37 and unmerged**. It is not
   on `main`. **If PR #37 does not merge, both tickets are invalid rather than blocked** and should be
   closed. `depends_on` names tickets and is graded against ticket state, so this precondition is in
   prose here and in §0 of each `ticket.yaml`, because there is no field for it and nothing in the
   loop will ask.
2. **Both are `depends_on: [CAL-03]`, which is row 1 and not yet DONE — so both fail Definition of
   Ready item 3 today, deliberately.** The dependency is a file collision rather than a behavioural
   one: CAL-03's `allowed_paths` claim five of the thirteen files in scope — `src/App.tsx` and
   `src/routes/Home.tsx` for OPS-001, and `src/routes/EditEntry.tsx`, `src/lib/data/mock.ts` and
   `src/lib/data/supabase.ts` for OPS-002. One working directory, one branch (ADR-006).
3. **Waiting costs something measurable, which is the argument for placing them early once CAL-03
   ships.** Twelve `PLANNED` rows above will each be built in English by the standard alone, at no
   cost, while the seven shipped features stay Vietnamese — so every row that ships before these two
   adds another screen where the two languages meet. CAL-03 is already the first: its new
   `src/routes/TeamEntries.tsx:43-60` declares English label maps against `src/components/EntryForm.tsx:34-46`
   in Vietnamese, a third copy of the same label sets, and its own developer wrote the handover into
   the file at `:40-42`. **OPS-002 is the ticket that reconciles all three.**

**Neither branch is `ops/<slug>`.** `feat/OPS-001` and `feat/OPS-002`, because
`scripts/check-allowed-paths.mjs:96-98` exits 0 with *"nothing to check"* on any branch not beginning
`feat/` — so an `ops/` name would run RULE-03 unenforced across shipped application files. That is the
same trade-off the operator settled for `feat/BUG-001` on 2026-09-03, and the residual contradiction
with `git-conventions.md:36` is recorded in each ticket's §4 rather than reopened.

**CORRECTION, `orchestrator` at /ship on 2026-09-03 — the two rows above are now 12 and 13, and the
paragraph that opens this block is left standing rather than rewritten.** It says *appended at rows 13
and 14* and *nothing was renumbered*, and both were true when `product` wrote them: CAL-03 was still
row 1. CAL-03 shipped in the same hour and left this table, so every row below it moved up one.
**Bookkeeping, not a reordering** — no row moved relative to another, and `product` still asserts
nothing about their position.

**Their point 2 is overtaken: `depends_on: [CAL-03]` now passes Definition of Ready item 3**, because
CAL-03 is `DONE`. The file collision it describes is spent — CAL-03's `allowed_paths` are released and
its five contested files reach `main` with [#38](https://github.com/didi-code0980/calechip/pull/38).
**Point 1 is untouched and is the one that still blocks:** both tickets rest on `§ Language` in
`.ai/standards/ui-design-system.md`, which exists only in commit `3ccbd37` on `ops/ui-language-english`,
open as PR #37 and unmerged. If #37 does not merge, both tickets are invalid rather than blocked. No
ticket field carries that, which is why it is prose — and why nothing in the loop will ask.

**Renumbered to 1–9 by `orchestrator` at /ship on 2026-09-04**, when CAL-06 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **ADM-01 is now row 1** — the first non-CAL row to reach
the top of this list, and it is unblocked: its `depends_on` gained CAL-04 in #45 and CAL-04 shipped
in #48. The CAL group is down to CAL-07 and CAL-08, both of which wait on things ADM rows own.

**Renumbered to 1–10 by `orchestrator` at /ship on 2026-09-04**, when CAL-05 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **The whole range was renumbered this time, OPS-002
included** — the correction below explains why that is worth saying.

**CORRECTION, `orchestrator`, 2026-09-04 — OPS-002 is row 11, not 12.** The CAL-04 ship below
renumbered the rows only as far as ADM-06 and left OPS-002 where it was, so the table read 1–10 and
then 12 with no row 11. Fixed while resolving this branch against `main`. Bookkeeping, not a
reordering: OPS-002 has not moved relative to any row, it was simply numbered wrong for one commit.

**Renumbered again to 1–10 by `orchestrator` at /ship on 2026-09-04**, when CAL-04 left this table
for `## ARCHIVE`. Bookkeeping, not a reordering. **CAL-05 is now row 1**, and ADM-01 — row 3 — is
newly unblocked in fact rather than on paper: its `depends_on` gained CAL-04 in #45 precisely because
CAL-04 owns the `team` select policy, and CAL-04 has now shipped it.

**Renumbered again to 1–12 by `orchestrator` at /ship on 2026-09-03**, when CAL-02 left this table
for `## ARCHIVE`. Bookkeeping, not a reordering. **CAL-03 is now row 1 and is blocked on nothing** —
its `Blocked on` names CAL-02, which is now DONE.

**Renumbered again to 1–13 by `orchestrator` at /ship on 2026-09-03**, when CAL-01 left this table
for `## ARCHIVE`. Bookkeeping, not a reordering. **CAL-02 is now row 1 and it is blocked on nothing**
— its `Blocked on` names CAL-01, which is now DONE.

**Renumbered again to 1–14 by `orchestrator` at /ship on 2026-09-03**, when TEA-05 left this table
for `## ARCHIVE`. Bookkeeping, not a reordering. **CAL-01 is now row 1**, and it is there because
every row a human placed above it has shipped — not because anyone moved it.

**The rows above were renumbered to 1–15 by `orchestrator` at /ship on 2026-09-03**, when BUG-001
left this table for `## ARCHIVE`. **Bookkeeping, not a reordering** — no row moved relative to
another, and TEA-05 is row 1 again by the same operator placement recorded below, not by a new one.

**The operator placed TEA-05 at row 1 on 2026-09-01**, and the fourteen rows below it moved down one.
That is a reordering, not the bookkeeping renumbering described below — a human moved a row relative
to the others, which is the only way that is allowed to happen.

*The paragraph below was written by `product` when the row was appended, and is kept because it names
the two facts the reorder rested on.* **TEA-05 was appended, not inserted.** This file's header says
it is an ordered list that a human reorders, so placing the row anywhere above 17 would have
renumbered sixteen rows a human placed. `product` asserts nothing about its position. Two facts a human reordering it should have:
`depends_on` is `[TEA-01]`, which is `DONE`, so nothing blocks it; and no row above it names TEA-05
in `Blocked on`, although each of them describes something a signed-in person does.

**The rows above have been renumbered twice by `orchestrator` on 2026-09-01** — to 1–16 when
TEA-03 left this table for `## READY`, and to 1–15 when TEA-04 did. `product`'s paragraph is left as
written; read its *17* and *sixteen rows* as the positions at the time it was written. TEA-05 is now
row 1, placed there by the operator on 2026-09-01. **The renumbering is
bookkeeping and never a reordering** — no row has moved relative to another since a human placed it.

**BUG-001 was appended at row 16 by `product` on 2026-09-01, and `product` asserts nothing about its
position.** Same stance as the TEA-05 paragraph above: this file's header says a human reorders, so
placing a row anywhere above 16 would have moved fifteen rows a human placed. The fact a human needs
in order to place it: **ADR-021 §Consequences requires this ticket ahead of CAL-01, which is row 2**,
and states why in its own words — *"Until it lands, no ticket can pass the QA gate, because Definition
of Done item 3 requires the suites to exit 0."* Item 3 was suspended under ADR-017 and is restored by
ADR-021, so this is not a preference about ordering: **until BUG-001 lands, no ticket in this table can
pass the QA gate at all**, on any machine carrying a `.env`. It is `depends_on: []` and blocked on
nothing, so it can be placed anywhere. `.ai/board/tickets/BUG-001/ticket.yaml` §4 carries one thing a
human must settle before it starts, and it is not its position: the branch name.

**The operator placed BUG-001 at row 1 on 2026-09-01**, above TEA-05, and the fifteen rows below it
moved down one. That is a reordering, not the bookkeeping renumbering described above — a human moved
a row relative to the others, which is the only way that is allowed to happen. `product`'s paragraph
immediately above is left as written; read its *row 16* as the position at the time it was written.
The operator was asked because ADR-021 §Consequences requires this ticket ahead of CAL-01 while this
file's own header reserves reordering to a human, and those two are only reconcilable by asking.

**The branch name was settled in the same exchange: `bugfix/BUG_TEA-01_01`**, which is
`.ai/standards/git-conventions.md:32` followed exactly. The operator was shown, and accepted, that
`bugfix/` branches run with the RULE-03 path guard inactive in both resolvers
(`git-conventions.md:44-49`) and that this ticket edits shipped test files. `branch` is set in
`.ai/board/tickets/BUG-001/ticket.yaml`; the guard consequence is recorded there in §4 so that
whoever runs `/implement` reads it rather than rediscovering it.

**CORRECTION, `orchestrator` at /ship on 2026-09-03 — the branch is `feat/BUG-001`, and the paragraph
above is left standing rather than rewritten.** The operator superseded the 2026-09-01 choice on
2026-09-03, after `tech-lead-design` measured a fact that was not available at triage:
`scripts/check-allowed-paths.mjs:90` resolves a `feat/` branch to its ticket and finds
`.ai/board/tickets/BUG-001/ticket.yaml`, so the option triage had presented as *unavailable* is the
only one under which RULE-03 is enforced in CI — a `bugfix/` branch exits 0 saying "nothing to
check" (`:85-87`). So the guard consequence the paragraph above warns about **does not apply**:
`allowed_paths` is checked mechanically on this branch, and `/ship` step 6 is where that check runs
against the committed diff. The full record, including what the new name costs against
`git-conventions.md:36`, is the §4 CORRECTION block at the end of that `ticket.yaml`.

## BLOCKED

Tickets that cannot proceed until a human decides something. Name the decision, not the topic.

| # | Ticket | Blocked on | Since | Who decides |
|---|--------|------------|-------|-------------|

**`MIR-08` left this table on 2026-10-23**: its review could not run R1–R3 because the review session was denied the verify commands; R4–R8 showed no defect. The allow rules are in [#176](https://github.com/didi-code0980/calechip/pull/176). State back to `REVIEW`; `/review` re-runs in a fresh session.

**`MIR-05` left this table on 2026-10-21**: the operator's holiday rows merged in [#169](https://github.com/didi-code0980/calechip/pull/169) (99-questions.md option A); `/review` re-ran in a fresh session and passed. State back to `REVIEW`.

**`CICD-05` left this table on 2026-10-14**: the operator chose option 3 — `src/components/TopBar.tsx` from the three chore commits ships with the ticket as an accepted exception (note in its `ticket.yaml`). State back to `REVIEW`; `/review` re-runs in a fresh session.

## SHIPPED OUTSIDE THE LOOP

Features built by `/solo` — no ticket, no plan, no gate — and registered in `.ai/registry/features.md`
afterwards. **Not a queue.** These rows are already on `main`; `/next-ticket` reads `## READY` and
`## BACKLOG` only, and a row here must never be moved into either, or the loop would plan and build
again what already exists. To put one of them through the gates after the fact, `/triage` a new idea
against its ID.

Rows 1–6 were added by the steward on 2026-10-08, on the operator's instruction *"tạo feature ID cho
các tính năng mới và đưa vào backlog"*. The four solo rows registered earlier — `TEA-06`, `TEA-08`,
`ADM-07`, `UIE-11` — are listed below them for completeness; nothing about them changed here except
`TEA-06`'s status. Changes solo made to features that already had a row are recorded in that row's
`Notes`, not here.

| # | Feature | Title | Built by `/solo` | Registered |
|---|---------|-------|------------------|------------|
| 1 | CAL-13 | A member marks a date busy; the team sees how many people did, and who | 2026-09-11 | 2026-10-08 |
| 2 | ADM-08 | A team chooses, per entry type, whether a new entry waits for an admin | 2026-09-11 | 2026-10-08 |
| 3 | TEA-09 | A person signs up, waits, and an admin admits them onto a team or rejects them | 2026-09-10 | 2026-10-08 |
| 4 | TEA-10 | A member edits their own display name, avatar and password from a profile screen | 2026-09-10 | 2026-10-08 |
| 5 | TEA-11 | An admin creates, renames and deletes an empty team, admits a sign-up onto any team, and moves a member between teams | 2026-09-11 | 2026-10-08 |
| 6 | TEA-12 | A third role, manager, decides entries and nothing else | 2026-09-12 | 2026-10-08 |
| 7 | TEA-06 | The member tab shows team and last sign-in, and carries view, edit and delete per row | 2026-09-10 | 2026-09-12 |
| 8 | TEA-08 | An admin sets a rank on any team | 2026-09-26 | 2026-09-26 |
| 9 | ADM-07 | A member reports an issue, with optional screenshots, from a floating button; an admin reads the reports and sees how many are not done | 2026-09-26 | 2026-09-28 |
| 10 | UIE-11 | Every password box carries a reveal control | 2026-09-28 | 2026-09-28 |

## ARCHIVE (last 20)

| # | Ticket | Title | Shipped | PR |
|---|--------|-------|---------|-----|
| 1 | MIR-21-b | Every writer writes `membership` directly, and the mirror trigger, `member_team_id()` and `member.team_id` are dropped — writer slice (ADR-078; the drop moved to MIR-21-c) | 2026-11-05 | PENDING_PR |
| 2 | MIR-21-c | The team lock moves to `membership`: a trigger refuses a write to the caller's own rows — team-lock slice (ADR-080; the drop is MIR-21-f) | 2026-11-06 | PENDING_PR |
| 3 | MIR-15-b | Only a system admin sets Org public's holidays, from the system panel, and each org reads only its own holiday calendar — holiday slice (ADR-079; the member app moved to MIR-15-e) | 2026-11-06 | PENDING_PR |
| 4 | MIR-15-e | The member app stops offering holiday edits in Org public, and the mock seam reproduces Org public's holiday policies — member slice (ADR-079 decision 5) | 2026-11-06 | PENDING_PR |
| 5 | MIR-21-d | Writers stop writing `member.team_id`, and no test reads it — writer slice (ADR-080 decision 2; the drop is MIR-21-f) | 2026-11-07 | PENDING_PR |
| 6 | MIR-21-e | No fixture names `member.team_id`: every fixture writes `membership` itself — fixture slice (ADR-081; the fixtures of 100, 160 and 240 move to MIR-21-f) | 2026-11-07 | PENDING_PR |
| 7 | MIR-21-f | `member.team_id`, `member_team_id()` and the mirror's insert branch are dropped — drop slice (ADR-080 decision 4, ADR-081) | 2026-11-07 | PENDING_PR |
| 8 | MIR-16 | The database splits admin into system_admin, org_admin and a per-team manager — first slice: issue reports go to the system panel (ADR-082; `org_admin` is MIR-16-b, `manager` is MIR-16-c) | 2026-11-07 | PENDING_PR |
| 9 | MIR-16-b | `is_org_admin(uid, org_id)` replaces `is_admin(uid)` at every call site — second slice of the role split (ADR-083; the `org_admin` rename is MIR-16-d) | 2026-11-07 | PENDING_PR |
| 10 | MIR-16-d | The pgTAP fixtures name the admin role through one helper, `tests.member_role`: the harness and seven files — fixture slice of the role split (ADR-084; the in-place rename is MIR-16-e) | 2026-11-07 | PENDING_PR |
| 11 | MIR-16-e | The value `admin` is renamed `org_admin` in place: the type, the five bodies, bootstrap, seed, the seam's mapping, and the last five fixtures — rename slice (ADR-084 decision 2) | 2026-11-07 | PENDING_PR |
| 12 | MIR-16-c | `manager` leaves `member.role`: every manager check reads `membership.team_role` — read slice of the manager rank (ADR-085; the write side and the enum removal move to MIR-16-f) | 2026-11-08 | PENDING_PR |
| 13 | MIR-16-f | `set_member_role` writes the team role, not `member.role` — write slice of the manager rank (ADR-086; the column retype and enum removal move to MIR-16-g) | 2026-11-08 | PENDING_PR |
| 14 | MIR-16-g | The pgTAP fixtures say which team role they mean, and stop spelling `'manager'` as a member role — fixture slice of the manager rank (ADR-087; the column retype moves to MIR-16-h) | 2026-11-08 | PENDING_PR |
| 15 | MIR-16-h | `'manager'` leaves `public.member_role`: the column is re-typed, the audit history keeps its words as text, and `set_member_role` takes text — last slice of the role split (ADR-086 decision 2, ADR-087 decision 2) | 2026-11-08 | PENDING_PR |
| 16 | MIR-17 | Issue reports leave the member app — first slice of the client role-guard work (ADR-088; the rest of P4-2 is MIR-17-b) | 2026-11-08 | PENDING_PR |
| 17 | MIR-17-b | Every `me.role !== "admin"` guard goes through `mayAdminister`, and a manager is labelled a manager on Teams — second slice of the client role-guard work (ADR-089; the rest of P4-2 is MIR-17-c) | 2026-11-08 | PENDING_PR |
| 18 | MIR-17-c | The approval worklist decides per row, per team, from `listEntryOwners` — third slice of the client role-guard work (ADR-090; the rest of P4-2 is MIR-17-d) | 2026-11-09 | PENDING_PR |
| 19 | MIR-17-d | The seam's `appRole` reads the manager rank from `manages_a_team`, not a single team's role — fourth slice of the client role-guard work (ADR-091; the rest of P4-2 is MIR-17-e) | 2026-11-09 | PENDING_PR |
| 20 | MIR-17-e | The entry and event affordances ask `mayAdminister` — fifth slice of the client role-guard work (ADR-092; the rest of P4-2 is MIR-17-f) | 2026-11-09 | PENDING_PR |

**The window displaced `MIR-21` at MIR-17-e's ship** — *MIR-21, `member.team_id` is dropped once every reader has moved to `membership` — read slice (ADR-077, roster team), shipped 2026-11-05,* PENDING_PR.

**The window displaced `MIR-15` at MIR-17-d's ship** — *MIR-15, In Org public, the directory, public events and event notifications stay within the team, only system_admin sets its holidays, and a team can be moved to another org — first slice (ADR-076), shipped 2026-11-05,* PENDING_PR.

**The window displaced `MIR-18-b` at MIR-17-c's ship** — *MIR-18-b, A system admin lists, creates and edits orgs — caps and licence state — from the panel, which is served unindexed at an unguessable path with rate limiting and failed-login logging, shipped 2026-11-05,* [#190](https://github.com/didi-code0980/calechip/pull/190).

**The window displaced `MIR-18` at MIR-17-b's ship** — *MIR-18, A separate system admin panel, unindexed, with its own account store, 2FA and org management — first slice (ADR-074), shipped 2026-11-05,* [#189](https://github.com/didi-code0980/calechip/pull/189).

**The window displaced `MIR-14-b` at MIR-17's ship** — *MIR-14-b, Each relevant manager's worklist shows a multi-team member's pending entry with the owner's name and the teams it affects, and the decision records are shown, shipped 2026-11-04,* [#188](https://github.com/didi-code0980/calechip/pull/188).

**The window displaced `MIR-14` at MIR-16-h's ship** — *MIR-14, A multi-team member's entry needs approval if any of their teams requires it, the first decision wins, any rejection rejects, and both approver and rejecter are recorded, shipped 2026-11-03,* [#187](https://github.com/didi-code0980/calechip/pull/187).

**The window displaced `MIR-13-b` at MIR-16-g's ship** — *MIR-13-b, Every read policy and read definer function resolves teams through `member_team_ids` and is bounded by `org_id`, and `getTeam()` and the overload warning survive a member on several teams, shipped 2026-11-03,* [#186](https://github.com/didi-code0980/calechip/pull/186).

**The window displaced `MIR-13` at MIR-16-f's ship** — *MIR-13, The policy layer is rewritten against `membership` and `org_id`, and no definer function trusts a client-supplied team id alone — write slice (ADR-071), shipped 2026-11-03,* [#185](https://github.com/didi-code0980/calechip/pull/185).

**The window displaced `MIR-12` at MIR-16-c's ship** — *MIR-12, `org_id` is added and backfilled into Org public, `membership` is backfilled from `member.team_id`, and `member.team_id` is dropped last, shipped 2026-11-01,* PENDING_PR.

**The window displaced `MIR-11` at MIR-16-e's ship** — *MIR-11, Composite foreign keys make a cross-org insert impossible at the database, shipped 2026-10-27,* PENDING_PR.

**The window displaced `MIR-10` at MIR-16-d's ship** — *MIR-10, The org and multi-team membership schema is designed and approved before any migration, shipped 2026-10-27,* PENDING_PR.

**The window displaced `MIR-09` at MIR-16-b's ship** — *MIR-09, Known schema inconsistencies are cleaned up: transaction wrapping, allow-list references, an index on `member.team_id`, a check on the overload threshold, shipped 2026-10-27,* PENDING_PR.

**The window displaced `MIR-08` at MIR-16's ship** — *MIR-08, `supabase/db.sql` is regenerated from the applied migrations or retired, and CI fails on drift, shipped 2026-10-23,* PENDING_PR.

**The window displaced `MIR-07` at MIR-21-f's ship** — *MIR-07, The mock is no looser than SQL on any permission decision, and a parity test enforces it, shipped 2026-10-23,* PENDING_PR.

**The window displaced `MIR-06` at MIR-21-e's ship** — *MIR-06, An SQL isolation suite proves each boundary as a real authenticated role against real policies, shipped 2026-10-23,* [#171](https://github.com/didi-code0980/calechip/pull/171).

**The window displaced `MIR-05` at MIR-21-d's ship** — *MIR-05, pgTAP runs locally and in CI against a real Postgres with every migration applied, shipped 2026-10-21,* [#170](https://github.com/didi-code0980/calechip/pull/170).

**The window displaced `MIR-01` when PR #194 (MIR-21-c) was merged with main after #195 and #196** — *MIR-01, The service role key and the anon key are rotated, and the rotation is recorded, shipped 2026-10-21,* [#168](https://github.com/didi-code0980/calechip/pull/168). MIR-21-c shipped first (2026-11-06T04:19Z), so its row sits above MIR-15-b's; on its own branch it had displaced `MIR-03`, which MIR-15-b's ship had already recorded.

**The window displaced `MIR-04` at MIR-15-e's ship** — *MIR-04, The member directory returns only members of the caller's own teams, and the event-invitee check is audited, shipped 2026-10-21,* [#167](https://github.com/didi-code0980/calechip/pull/167).

**The window displaced `MIR-03` at MIR-15-b's ship** — *MIR-03, Role changes are bounded to members the admin administers, promotion to admin is a separately gated action, and every role change records its actor, shipped 2026-10-20,* [#166](https://github.com/didi-code0980/calechip/pull/166).

**The window displaced `MIR-02` at MIR-21-b's ship** — *MIR-02, A member's own role, status and team can be changed only through bounded, definer-checked paths, shipped 2026-10-20,* [#165](https://github.com/didi-code0980/calechip/pull/165)

**The window displaced `TSK-06` at MIR-21's ship** — *TSK-06, The task page shows the week around the selected day, with progress, and a task may carry an optional time of day, shipped 2026-10-18,* PENDING_PR

**The window displaced `TSK-04` at MIR-15's ship** — *TSK-04, The week view shows, in each day's header, how many of the viewer's own tasks are done out of the total, shipped 2026-10-18,* [#156](https://github.com/didi-code0980/calechip/pull/156)

**The window displaced `TSK-03` at MIR-18-b's ship** — *TSK-03, A member declaring PTO is warned about their own tasks on those days, without being stopped, shipped 2026-10-17,* [#155](https://github.com/didi-code0980/calechip/pull/155)

**The window displaced `TSK-02` at MIR-18's ship** — *TSK-02, Each time the app opens, a member is shown their overdue tasks and can tick them or move them all to today, shipped 2026-10-17,* [#153](https://github.com/didi-code0980/calechip/pull/153)

**The window displaced `TSK-05` at MIR-14-b's ship** — *TSK-05, Ticking a task done or not done changes on screen at once, and the server's answer confirms or undoes it, shipped 2026-10-16,* [#150](https://github.com/didi-code0980/calechip/pull/150)

**The window displaced `TSK-01` at MIR-14's ship** — *TSK-01, A member keeps a private list of tasks for each day, and only they can read or change it, shipped 2026-10-15,* [#149](https://github.com/didi-code0980/calechip/pull/149)

**The window displaced `EVT-14` at MIR-13-b's ship** — *EVT-14, A signed-out reader of a guest link is offered sign-in and sign-up, and signing in returns them to the event, shipped 2026-10-15,* [#146](https://github.com/didi-code0980/calechip/pull/146)

**The window displaced `UIE-12` at MIR-13's ship** — *UIE-12, The way to join an event stays in view while its page scrolls, on `/events/:id` and on `/guest/:token`, shipped 2026-10-15,* [#145](https://github.com/didi-code0980/calechip/pull/145)

**The window displaced `EVT-13` at MIR-12's ship** — *EVT-13, A signed-in member who opens a guest link to an event they can read is taken to the event in the app, shipped 2026-10-15,* [#141](https://github.com/didi-code0980/calechip/pull/141)

**The window displaced `EVT-12` at MIR-11's ship** — *EVT-12, The creator or an admin of an Own team or Limited people event invites people by email, a member outside its reach is added to its named list, and Named people is relabelled Limited people, shipped 2026-10-14,* [#140](https://github.com/didi-code0980/calechip/pull/140)

**The window displaced `CICD-07` at MIR-10's ship** — *CICD-07, The self-hosted runner on the WSL server has a hand-run setup runbook, and the deploy workflow selects it by the label `mmlabs-server`, shipped 2026-10-14,* [#138](https://github.com/didi-code0980/calechip/pull/138)

**The window displaced `CICD-06` at MIR-09's ship** — *CICD-06, The pipeline, its secrets, how to cut a release and how to roll one back are written down, and the standards that describe CI match it, shipped 2026-10-14,* [#135](https://github.com/didi-code0980/calechip/pull/135)

**The window displaced `CICD-05` at MIR-08's ship** — *CICD-05, The deployment repository deploys only CaleChip from merged config, health-checks it and restores the previous version on failure — drafted in this repository, shipped 2026-10-14,* [#134](https://github.com/didi-code0980/calechip/pull/134)

**The window displaced `CICD-04` at MIR-07's ship** — *CICD-04, A version tag on `main` promotes the image already built for that commit, by digest and without rebuilding, and opens a release pull request in the deployment repository, shipped 2026-10-14,* [#133](https://github.com/didi-code0980/calechip/pull/133)

**The window displaced `CICD-03` at MIR-06's ship** — *CICD-03, Every merge to `main` builds one image, pushes it to Docker Hub tagged by its commit, and smoke-tests it against the image's health endpoint, shipped 2026-10-13,* [#132](https://github.com/didi-code0980/calechip/pull/132)

**The window displaced `CICD-02` at MIR-05's ship** — *CICD-02, A push to a feature branch gets lint, typecheck and unit results within about three minutes, and a pull request runs the full gate as named, required checks, shipped 2026-10-13,* [#131](https://github.com/didi-code0980/calechip/pull/131)

**The window displaced `CICD-01` at MIR-01's ship** — *CICD-01, The pull-request gate is green on `main` again, with each failing end-to-end test quarantined against a ticket in a register, shipped 2026-10-13,* PENDING_PR

**The window displaced `EVT-11` at MIR-04's ship** — *EVT-11, A creator puts pictures in an event's description, downscaled and capped in size, shipped 2026-10-13,* [#127](https://github.com/didi-code0980/calechip/pull/127)

**The window displaced `EVT-10` at MIR-03's ship** — *EVT-10, A creator formats an event's description, and every surface that shows it renders it sanitised, shipped 2026-10-13,* [#126](https://github.com/didi-code0980/calechip/pull/126)

**The window displaced `EVT-09` at MIR-02's ship** — *EVT-09, A creator enters email addresses to invite while creating a public event, shipped 2026-10-12,* [#125](https://github.com/didi-code0980/calechip/pull/125)

**The window displaced `EVT-08` at TSK-06's ship** — *EVT-08, The creator or an admin of a public event invites people by email from the event's page, and each address is mailed once, shipped 2026-10-12,* [#124](https://github.com/didi-code0980/calechip/pull/124). TSK-04's PR column corrected from `PENDING_PR` to #156, merged (`185a5c6` on `origin/main`).

**The window displaced `EVT-07` at TSK-04's ship** — *EVT-07, A guest registers for an opened event with a name and an email, and manages it from a link shown once, shipped 2026-10-09,* [#118](https://github.com/didi-code0980/calechip/pull/118).

**The window displaced `EVT-06` at TSK-03's ship** — *EVT-06, A creator opens an event to guests, and anyone with its link reads it and who is coming, shipped 2026-10-09,* [#117](https://github.com/didi-code0980/calechip/pull/117).

**The window displaced `EVT-05` at TSK-02's ship** — *EVT-05, A person is emailed when an event for their team is created, when they are invited, and when their request is decided, shipped 2026-10-09,* [#116](https://github.com/didi-code0980/calechip/pull/116).

**The window displaced `EVT-04` at TSK-05's ship** — *EVT-04, A person is notified in the app when an event concerns them, shipped 2026-10-08,* [#114](https://github.com/didi-code0980/calechip/pull/114).

**The window displaced `EVT-03` at TSK-01's ship** — *EVT-03, Events are drawn on the week and month grids, and a click opens the event, shipped 2026-10-08,* [#113](https://github.com/didi-code0980/calechip/pull/113).

**The window displaced `CAL-12` at EVT-14's ship** — *CAL-12, An admin chooses which team the three calendar screens and the sidebar roster show, read-only, shipped 2026-10-01,* [#108](https://github.com/didi-code0980/calechip/pull/108), merged — corrected from `PENDING_PR` at EVT-03's ship.

**The window displaced `EVT-02` at UIE-12's ship** — *EVT-02, A member joins an event they can read, within its capacity, approval mode and deadline, and everyone who can read it sees who is coming, shipped 2026-09-29,* [#106](https://github.com/didi-code0980/calechip/pull/106), merged — corrected from `PENDING_PR` at CAL-12's ship.

**The window displaced `EVT-01` at EVT-13's ship** — *EVT-01, A member announces an event to their own team, to named people, or to every team, and those it is for can read it, shipped 2026-09-29,* [#105](https://github.com/didi-code0980/calechip/pull/105), merged — corrected from `PENDING_PR` at EVT-02's ship.

**The window displaced `CAL-11` at EVT-12's ship** — *CAL-11, An admin reads any team's entries and roster through the seam, shipped 2026-09-23,* [#95](https://github.com/didi-code0980/calechip/pull/95).

**The window displaced `UIE-10` at CICD-07's ship** — *UIE-10, The sidebar gives up its admin links and restyles its roster; the specs route through the hub, shipped 2026-09-09,* [#86](https://github.com/didi-code0980/calechip/pull/86), merged — corrected from `PENDING_PR` at CAL-11's ship.

**The window displaced `CAL-09` at CICD-03's ship** — *CAL-09, The calendar reads serve a year larger than one datastore page, shipped 2026-09-08,* [#79](https://github.com/didi-code0980/calechip/pull/79).

**The window displaced `UIE-07` at CICD-02's ship** — *UIE-07, The week view renders a per-day absence count, shipped 2026-09-08,* [#77](https://github.com/didi-code0980/calechip/pull/77).

**The window displaced `BUG-002` at CICD-01's ship** — *BUG-002, Two row limits sit above the datastore cap, so four truncation assertions can never fire, shipped 2026-09-08,* [#76](https://github.com/didi-code0980/calechip/pull/76).

**The window displaced `UIE-06` at EVT-11's ship** — *UIE-06, The month grid becomes one ruled full-width card with taller cells, on the product's tokens, shipped 2026-09-08,* [#73](https://github.com/didi-code0980/calechip/pull/73).

**The window displaced `UIE-05` at EVT-10's ship** — *UIE-05, The week column fills the viewport, and its header strip and entry chip are restacked, shipped 2026-09-08,* [#72](https://github.com/didi-code0980/calechip/pull/72).

**The window displaced `OPS-004` at EVT-09's ship** — *OPS-004, A password-free bootstrap file that creates the first team and the first admin, shipped 2026-09-07,* [#71](https://github.com/didi-code0980/calechip/pull/71).

**The window displaced `UIE-04` at EVT-08's ship** — *UIE-04, The week view as seven day columns, shipped 2026-09-07,* [#66](https://github.com/didi-code0980/calechip/pull/66).

**The window displaced `UIE-03` at EVT-07's ship** — *UIE-03, The calendar screens give up their own chrome to the shell, shipped 2026-09-07,* [#65](https://github.com/didi-code0980/calechip/pull/65).

**The window displaced `UIE-02` at EVT-06's ship** — *UIE-02, The application shell — a persistent sidebar and top bar, shipped 2026-09-07,* [#64](https://github.com/didi-code0980/calechip/pull/64).

**The window displaced `UIE-01` at EVT-05's ship** — *UIE-01, Restyle the sign-in and sign-up screens to the product's visual direction, shipped 2026-09-07,* [#63](https://github.com/didi-code0980/calechip/pull/63).

**The window displaced `OPS-002` at EVT-04's ship** — *OPS-002, UI copy to English — entry screens and the seam's error messages, shipped 2026-09-07,* [#62](https://github.com/didi-code0980/calechip/pull/62).

**The window displaced `ADM-06` at EVT-03's ship** — *ADM-06, Reject several entries at once, with one reason for the batch, shipped 2026-09-06,* [#60](https://github.com/didi-code0980/calechip/pull/60).

**The window displaced `ADM-03` at CAL-11's ship** — *ADM-03, Add, edit or delete a holiday or swap
day, shipped 2026-09-05,* [#55](https://github.com/didi-code0980/calechip/pull/55).

***`gh auth status` REPORTS A LOGGED-IN HOST FOR THE FIRST TIME ON THIS BOARD*** — `didi-code0980`,
ssh, at CAL-11's ship. Every earlier row in this table was written `PENDING_PR` because it did not,
and each was corrected by a follow-up `chore(<ID>):` commit. **`UIE-10`'s row was the last one
outstanding and is corrected here to [#86](https://github.com/didi-code0980/calechip/pull/86),
merged** — on the convention ADM-04, UIE-08, CAL-10 and UIE-09 set. **CAL-11's own row was written `PENDING_PR` for one turn and is filled here** — not because `gh`
failed, but because the commit that carries this table is what the pull request is opened *from*, so
the number cannot exist when the row is written. The follow-up `chore(CAL-11):` commit lands on the
same branch and into the same pull request, which is the form CAL-09 used (`56b608c`).

***THREE REVIEW PASSES, AND ALL THREE FAILURES WERE THE MODEL FAILING ITSELF RATHER THAN THE CODE.***
The five files in `allowed_paths` passed R2–R8 on the first pass and were never edited again. What
failed was R1, three times, on paths no loop role was permitted to touch: `.claude/settings.json`
with its `deny` array emptied, then `ADR-042` and `CAL-12`'s shell sitting untracked, then nine
`ops/` paths dirty only because the branch was two commits behind `origin/main`. **This one ticket
produced three ADRs** — [ADR-041](../registry/decisions/ADR-041-r1-and-r3-judge-what-the-developer-wrote.md)
(R1 and R3 judge what the Developer wrote), [ADR-042](../registry/decisions/ADR-042-inv-04-accepts-the-removed-member-shape-until-both-sides-are-fixed.md)
(the INV-04 answer) and [ADR-043](../registry/decisions/ADR-043-r1-asks-the-runner-what-is-carried.md)
(R1 asks `scripts/check-carry.mjs` what is carried). The loop spent a day on its own plumbing and the
product code was ready at the start of it.

***INV-04 IS KNOWINGLY NOT HELD AND THIS SHIP IS WHERE THAT BECOMES MERGED CODE.*** A removed
member's entries are invisible on **every** date, including the ones before `removed_at` where INV-04
counts them — on the own-team reads, which predate this ticket, and now on the three cross-team reads
it adds. ADR-042 § Decision 1 is the operator's accepted deviation, not a claim the invariant holds,
and § Decision 3 owes **one ticket that fixes both sides together** — never one side then the other,
because ADR-040's revert condition is that the two views must not disagree on a count. That ticket is
blocked on a `features.md` row under RULE-01 and is not on this board yet.

**Definition of Done item 3 is covered by REVIEW, not by this ship: step 1 was skipped on the
operator's instruction** — *tạm ignore bước này* — as on the seventeen ships before it. The second
review pass ran `tsc --noEmit` 0, `eslint` 0 and `vitest run` 0 on the tree that ships. **End-to-end
was not run at any stage and is not claimed**; the migration is also unapplied and unverified against
a running PostgreSQL, which `01-plan.md` § *Out of scope* 9 states and `04-review.md` repeats — every
AC-6 through AC-8 denial was verified against the mock's reproduction of the function bodies.

**The earlier displacement note, kept:** **the window displaced `CAL-06` at UIE-08's ship** —
*CAL-06, Year view — one row per member across 365 days, shipped 2026-09-04,*
[#51](https://github.com/didi-code0980/calechip/pull/51). **It was a pointed one to lose:** CAL-06 is
the ticket that built the screen UIE-08 repainted, and the source of six of the nine acceptance
criteria ADR-032 would stop being observable.

**No rework, no consultation, no amendment, one review pass — the eighth in a row.** One source file,
twelve class-string substitutions and one comment; R1–R8 all PASS, each cited.

***THE ONE THING WORTH READING TWICE IS NOT IN THE DIFF.*** The `features.md` row this ship set to
`DONE` cites two idea files, and `01-plan.md` rests its whole scope on ADR-032 — and all three are
untracked and outside every set `/ship` commits. They are named in `## BACKLOG` above as item 6.

**The earlier displacement note, kept:** **the window displaced `CAL-05` at CAL-09's ship** — *CAL-05, Week view — per-person detail for one week,
with half-days, notes and who approved, shipped 2026-09-04,*
[#49](https://github.com/didi-code0980/calechip/pull/49). Reproduced on ADM-06's convention.

**No rework, no consultation, no amendment, one review pass — the seventh in a row.** Six files,
`vitest run` **12 files / 202 tests, 0 failures**, nine of them this ticket's, and **no existing test
edited or removed**.

***END-TO-END WAS NOT RUN AT ANY STAGE, AND THE STATED REASON DOES NOT HOLD. THAT IS THIS SHIP'S ONE
REAL FINDING.*** Both `03-impl-log.md` and `04-review.md` decline `playwright` citing
`playwright.config.ts:49-51` and MD-021's *six known harness failures*, and **declaring it rather than
hiding it is the right instinct** — but both halves of the citation are out of date:

- **`playwright.config.ts:49-51` is the FIX, not the defect.** It pins `VITE_DATA_SEAM: "mock"` and
  `VITE_SUPABASE_URL: ""`. That is BUG-001's fix, shipped 2026-09-03, and it is exactly what MD-021's
  *Fix shape* column asked for.
- **The six failures no longer happen.** The suite has run **165 passing** at UIE-04, UIE-05 and
  UIE-06, and **171** at UIE-07 hours before this ticket started.

**Two model-plane documents are stale and this is the first ticket to lean on them to skip a gate
command.** MD-021 is unresolved in `.ai/board/model-debt.md` only because nobody marked it — unlike
MD-015, which carries a `RESOLVED` banner. And `.ai/standards/testing-standards.md:35-41` still
records the suite as *10 tests in 2 files — 4 pass, 6 fail*, a state from 2026-09-01. **Both are
`/thuki`'s, and the `## BACKLOG` section above now carries them as item 4.**

**On the substance the ticket is sound.** The shape is **offset `range()`** over the `start_date`,`id`
order the read already has, with the offset advanced by rows in hand; **the keyset predicate was
considered and rejected on its merits**, so no index is wanted and `schema_delta: none` stands —
**re-evaluated at PLAN rather than inherited**, which is what the shell's fence asked for.

**`invariants_touched` is `[INV-04, INV-07]`, and INV-04 is engaged through COMPLETENESS rather than
arithmetic.** `absenceCountsFor` sums correctly over whatever rows it is handed; the whole question is
whether it is handed all of them. The property is therefore held **inside the seam, before any caller
counts**, and by the ban on a per-page sum (AC-10). INV-07 is listed because a multi-request read
**could** scope its requests differently and mix teams — held by `entry_select_team` filtering every
request, and by the mock filtering the whole array before the first window (AC-9).

**Two small things this ship corrected rather than carried.** `branch:` was `""` — the only one of
thirty-two tickets with the field empty, reported at `/next-ticket` twice and in PR #78's body, and
still empty after four stages. Nothing was blocked by it, because both guards resolve the ticket from
the **real git branch name** and never from this field, so filling it records a fact rather than
taking a decision. And both gate `at` values were written `+0700` without the colon, this ticket's
form alone; normalised to `+07:00`, same value.

**The window displaced `CAL-04` at this ship** — *CAL-04, Month view — a day grid showing who is away
and which days are overloaded, shipped 2026-09-04,*
[#48](https://github.com/didi-code0980/calechip/pull/48). Reproduced on ADM-06's convention, and it is
a pointed one to lose: CAL-04 is the row this ticket's number agrees with, and the row ADR-031 was
rejected to protect.

***THIS ROW EMPTIES THE BOARD FOR THE THIRD TIME***, and it is the first emptying where the queue
behind `/triage` is genuinely shorter than it was — the `## BACKLOG` section above says what is left.

**No rework, no consultation, no amendment, one review pass — the sixth in a row.** Two files, and
`playwright test` goes 165 → **171 passed with every shipped spec unedited**, which is AC-13.

***THE FIRST TICKET IN THIS PRODUCT BUILT FROM AN AGENT-ACCEPTED ADR.*** ADR-029 was signed
`ACCEPTED by orchestrator` on 2026-09-08 under the operator's delegation, and this row is what that
signature bought. Its four clauses are the substance of the criteria rather than a citation, and
`requires_adr: false` is a **fact** here rather than a first reading — the decision this ticket would
otherwise have stopped for was already taken.

***INV-06 IS A FAILURE MODE THIS TICKET CREATES AND NO OTHER SURFACE HAS.*** A half day weighs 0.5, so
the count is a **decimal** on some days — rendered directly beneath chips carrying `week-row-portion`,
INV-06's only visible surface in the product. **The risk is not a second definition. It is a display
decision** — `Math.round`, `toFixed(0)`, an integer format chosen for tidiness — taken **entirely
inside ADR-029 clause 1**, where the count is still INV-04's own and the screen still lies about the
half day. AC-8's *no rounding* is the whole guard, and it is a criterion rather than a comment.

**The cheapest wrong path had moved, and PLAN said where to.** It is no longer the chip count — clause
1 and UIE-04 closed that — it is **a local sum over the `absent` map already in scope three lines
away**. AC-3 and AC-4 are what catch it.

**INV-05 was named in order to be excluded, with the reason.** A column showing a
`week-row-tentative` chip over a count that excluded it would be the product's first visible
contradiction — but it is **unreachable without breaking INV-04 first**, because `absenceCountsFor`
never excludes a tentative entry. A decision, not an omission.

**The empty-state sentence was decided rather than inherited.** ADR-029 authorised this ticket to
*consider* deleting *"Everybody is in."* and authorised nothing further. It considered it and **kept
it**, which is why `tests/e2e/cal-05-week-view.spec.ts` never entered `allowed_paths` and why its
`:266` count of seven `week-day-empty` elements still holds.

**One prose slip in two artifacts, corrected here rather than in them.** `03-impl-log.md` and
`04-review.md` both say the suite gained *"the 7 new"* tests. The new spec file holds **six** `test(`
blocks, and 165 + 6 = 171, which is the total both artifacts report and which is right. The total is
the load-bearing number; the count of new blocks is not, and neither artifact is edited for it.

**The window displaced `OPS-001` at this ship** — *OPS-001, UI copy to English — chrome, account and
team screens, shipped 2026-09-03,* [#40](https://github.com/didi-code0980/calechip/pull/40).
Reproduced on ADM-06's convention.

**No rework, no consultation, no amendment, one review pass — the fifth in a row.** Two files outside
the ticket folder, no existing test edited, and the suite goes 186 → 193 tests on one added file.

***PLAN REFUSED THE FIX SHAPE ITS OWN SHELL RECOMMENDED, AND THE FIRST REASON IS A CONTRADICTION
INSIDE THAT SHELL.*** §3 recommended shape (d); §5 called the static test the **only available proof**
that the defect is fixed. But (d) leaves both constants at 2000 — **so that proof would still fail
after the fix**. Two sections of one file disagreeing, visible only to someone trying to write both at
once.

**The second reason is arithmetic and it dissolved §3's objection to shape (a).** §3 said lowering the
constants *"costs the year view first"*. It costs nothing: the datastore never returned more than 1000
anyway, so **no read loses a row it was getting**. What changes is that a truncation which is silent
today becomes an error.

**Scope fell from five files to two as a result.** Both seam implementations already compare
`rows.length >= LIMIT` against the imported constant — **correct as written once the constant does not
exceed the cap** — so lowering it repairs **four assertion sites across two files without opening
either**, and `src/lib/data/index.ts`'s contract comments become true without a word changing.

**`invariants_touched: [INV-04]`, argued from the mechanism rather than the statement.** The ticket
creates no second arithmetic and `absenceCountsFor` is untouched, which is the honest case for `[]`.
It is listed anyway because **the defect's whole consequence is that the single definition is reliably
fed a truncated set**: a sum over an arbitrary 1000 of 1400 matching rows is not the sum INV-04
defines, and nothing distinguishes it from one that is. `invariants.md:63` warns that concluding *no
invariant is engaged* from safe-**looking** behaviour is circular, and `[]` here would have been
exactly that shape.

**What shipped:** a new `DATASTORE_MAX_ROWS = 1000` naming the cap the `TODO(verify):` discharged at
ADM-04 established, the two limits lowered onto it, and `tests/row-limits.test.ts` asserting every
ceiling is `<=` the cap. **`<=` and not `<` is a decision**: the property is reachability, not margin,
and `HOLIDAY_LIMIT` has been correct at exactly 1000 since ADM-02 for that reason.

**Three limits of the fix, recorded rather than glossed.** A team with exactly 1000 overlapping
entries now gets a refusal it does not deserve — the established false positive, kept rather than
answered with a second convention. **A large team's year view can legitimately exceed 1000, and after
this it refuses instead of silently shortening** — better, and still a refusal rather than a calendar;
**paging is fix shape (c) and is the ticket that follows**. And the named ceiling is a constant this
repository asserts, not the value the project serves: lowering the real `max-rows` below 1000 puts the
ceilings wrong again with the new test still passing, and nothing here can read the real setting.

**Six end-to-end spec headers still carry the figure `2000` in prose** — `cal-04`, `cal-05`, `cal-06`,
`cal-07`, `cal-08`, `adm-02`. Their load-bearing claim survives; only the numeral is stale. Opening
six files for one number was refused, and it is recorded here so the next reader knows it was seen.

**The window displaced `CAL-03` at this ship** — *CAL-03, Edit or delete another member's entry, as an
admin, shipped 2026-09-03,* [#38](https://github.com/didi-code0980/calechip/pull/38). Reproduced on
ADM-06's convention.

**No rework, no consultation, no amendment, one review pass — the fourth such ticket in a row.** Two
files outside the ticket folder, no spec file opened, and `playwright test` returns 165 passed with
none modified.

***THIS ROW CARRIES THREE INVARIANTS — `[INV-04, INV-05, INV-06]`, the most of any ticket in this
product — AND EACH IS ENGAGED BY A DIFFERENT MECHANISM.*** None of them because the ticket changes any
arithmetic; `src/lib/data/absence.ts` is never opened.

- **INV-04.** The cell already shows one avatar **per member**, and that reads correctly *only*
  because the count beside them carries the arithmetic: an am+pm pair is one face and one whole day
  of count. Remove the count and the faces become the only reading available — a second, wrong
  definition of exactly the thing INV-04 exists to keep single.
- **INV-05.** The dashed reduced-opacity border is what shows an entry is tentative **while still
  being counted** — and **a ruled grid is precisely where a border treatment gets lost**, because the
  hairlines between cells are also thin lines. AC-14 states it as an outcome rather than a rule.
- **INV-06.** A half day's avatar is identical to a full day's on this screen, so **the count is the
  only surface on which INV-06 is visible here at all.** Distinct from INV-04: that one is the count
  *agreeing with* the faces; this one is the count being the only place a portion can be expressed.

**PLAN found a comment in `src/index.css:141-143` that refused a `--color-overload` token on three
clauses that were all false the day they were written.** `src/routes/MonthView.tsx:175` calls
`seam.getTeam()` and `:347` computes `isOverloaded` — verified at PLAN and again at REVIEW. The token
ships at `#ffe4e6`, **exactly today's `rose-100`**, so nothing changes visually: this is tokenisation,
not a colour decision. Without it the screen's one domain-bearing colour would have remained a raw
Tailwind default while six neighbours became tokens. The false comment is corrected in the same edit,
under the small-defect grant in `.ai/steward/context.md` § *Autonomy*.

***AND THE SAME FALSE CLAIM AT `src/components/Sidebar.tsx:63-64` WAS DELIBERATELY LEFT ALONE.***
Correcting a comment there would have put a **shell** file in `allowed_paths`, and RULE-03's guard
cannot distinguish a comment from a rewrite — the whole file becomes writable for the rest of the
ticket. §7.4 keeps the shell shut and `01-plan.md` *Open questions* reports the line instead. **It is
owed to a later ticket**, and it is the one item this ship added to the list under `## BACKLOG`.

**The window displaced `CAL-02` at this ship** —
*CAL-02, Edit or delete their own entry, shipped 2026-09-03,*
[#36](https://github.com/didi-code0980/calechip/pull/36). Reproduced on ADM-06's convention.

**No rework, no consultation, no amendment, one review pass — the third such ticket in a row.** One
file outside the ticket folder, no spec file edited, and all four commands re-run by the REVIEW
session on the final tree: `tsc` 0, `eslint` 0, `vitest run` 186 in 10 files, `playwright test` 165.

**PLAN corrected a claim in this ticket's own shell, and that correction is why `src/index.css`
stayed shut.** §3.4 called the card radius *"a token value, not a layout. Free."* **It is not free** —
`rounded-card` is shared by `AuthCard.tsx` (UIE-01's sign-in card) and `Sidebar.tsx` (UIE-02's shell)
as well as this screen, so moving `--radius-card` would have repainted two surfaces this ticket may
not touch. It is the same collision `src/index.css:117-123` already records for `--radius-lg`, one
token over. A Tailwind built-in went on the day column instead and AC-16 asserts both shared files
stay out of the diff.

**`invariants_touched` is `[INV-04, INV-06]` — two, where the shell proposed `[]` as the honest first
reading, and the second one is the find.** **The portion pill is INV-06's only visible surface in the
product.** A five-day `pm` entry is five afternoons, and the pill is how a reader sees that — and the
reference image **drops it**, which would have made the invariant invisible on the one screen that
shows it. AC-9 keeps it at rest, with `data-portion`. INV-04 repeats only UIE-04's *second* reason: no
number is added, but the presentation of the set that count sums is rewritten, and the tempting
space-saving at ~161px is merging a member's am and pm entries into one chip. AC-10 forbids it.

**No count was added or approximated while ADR-029 is still `PROPOSED`.** The refusal UIE-04
established holds, and the empty-state sentence stays with it — the two were never to be decided
independently.

**One declared deviation, and it was the plan's own to leave.** `01-plan.md` *Open question* 1
reserved the height declaration for a stage with a rendered viewport. `calc(100vh - 70px - 1.5rem)`
put the columns **56px below the fold** and made a quiet week scroll, because `seam-banner` renders
above the shell on every build the suite drives. `min-h-full` is offset-independent, lands on the
fold, and is a **minimum rather than a height** — so a busy column still grows past the pane, no
second scroller exists, and UIE-04's AC-4 and AC-5 are not reversed. Measured both ways in a rendered
viewport rather than reasoned about.

**The window displaced `CAL-01` at this ship, the seventh row out and the sixth in six ships** —
*CAL-01, Create an entry for themselves, over a range of dates, shipped 2026-09-03,*
[#32](https://github.com/didi-code0980/calechip/pull/32)*; board and registry in*
[#34](https://github.com/didi-code0980/calechip/pull/34). Reproduced on ADM-06's convention.
**The row that just went is the first CAL row and the oldest capability this product has** — every
TEA row has already left, so from the next ship the table starts eating the calendar. **Seven
reproduction paragraphs now stand where this table used to be the record.** MD-026 carries the
defect and names the two fixes; six ships have each chosen the prose rescue instead, which works
only for as long as an agent keeps noticing.

**The window displaced `TEA-05` at this ship, the sixth row out and the fifth in five ships** —
*TEA-05, Sign in, sign out, and the member-less landing state, shipped 2026-09-03,*
[#29](https://github.com/didi-code0980/calechip/pull/29)*; board and registry in*
[#30](https://github.com/didi-code0980/calechip/pull/30). Reproduced on ADM-06's convention. **Six
reproduction paragraphs now stand where this table used to be the record, and the window has
displaced a row at every ship since it filled.** The question first raised at ADM-06's ship has been
asked five times and answered none: either the heading grows, or something else becomes the permanent
record of what a ticket merged as. `metrics.md` has no PR column and cannot be it.

***THIS ROW EMPTIES THE BOARD.*** Twenty-six tickets, and `## BACKLOG` above is now an empty table for
the first time. What that means and what reopens the loop is written there rather than here.

**No rework, no consultation, no amendment, one review pass — the second such ticket in a row.**
`size: S`, **one file outside the ticket folder**: the shell already grants the pane full width and
every token the columns use shipped with UIE-01 and UIE-02, so `src/index.css` is untouched.
`ticket.yaml` §2 predicted two files and possibly four, and warned the §3 choice would move the cost
by more than the file count suggests. **It did, downward** — all three candidate spec files measured
out of scope, and not one test file is edited.

***THE ONLY TICKET IN THE `UIE` GROUP WHOSE `invariants_touched` IS NOT `[]`.*** It is `[INV-04]`,
exactly the exception §6 predicted against ADR-028's note that `[]` would be the answer on almost
every UIE row — recorded there as a **cost** of the group rather than permission to skip the question,
and this row is what that note was for.

**PLAN refused even triage's own recommendation, and that is the finding worth keeping.** §4 offered
the footer the day's own chip count as a safe substitute for `n/total vắng` — no arithmetic, no roster
read, no team call. **It is not safe.** A day holding one full-day entry and two half-day entries has
**three chips** and an absence count of **two**, so the footer would contradict the month grid for the
same date. **That is the second definition INV-04 exists to forbid, reached without ever opening
`absence.ts`** — which is precisely the shape CAL-04's row spent its whole length warning about. AC-13
adds no count at all, so §4's stop-and-ask never fired, `requires_adr: false` holds, and **no
amendment is owed to CAL-05's registry row**.

**Of §3's three options the plan took Option 3's breakpoint with Option 1's overflow behaviour**,
because neither answers both questions alone — Option 3 says what happens on a narrow viewport and is
silent about a full column on a wide one, Option 1 the reverse. **Option 2 was refused outright**: it
would have deleted `week-row-note` and `week-row-approver` from the resting view, which CAL-05's AC-6
and AC-7 assert, and pulled that spec file in behind them.

**1280px is originated here and is the product's first breakpoint.** `01-plan.md` *Open questions*
item 1 says the number is the one most worth arguing with, and that a later screen will inherit it by
copying rather than by reading a standard — **the same accumulation `§ Colour` and `§ Type` began at
UIE-01**, now with a third value in it. The BACKLOG section above records it as one of the three
things waiting for `/triage`.

**Two things the plan recorded rather than resolved**, both honest and neither blocking: the wrapped
column header's height at ~161px is still unmeasured — `ticket.yaml` §3's `TODO(verify)`, inherited
because it needs a rendered viewport, and it makes a column taller rather than shorter so AC-4's *the
page scrolls* absorbs it; and §8's first rejected alternative is **doing nothing**, argued seriously,
because the seven-column layout is not obviously better than the stacked one on a busy week.

**The window displaced `BUG-001` at this ship, the fifth row out and the fourth in four ships** —
*BUG-001, The end-to-end suite does not pin which seam it drives, shipped 2026-09-03,*
[#27](https://github.com/didi-code0980/calechip/pull/27)*; board files in*
[#28](https://github.com/didi-code0980/calechip/pull/28). Reproduced on ADM-06's convention. **This
one is the costliest displacement yet**: BUG-001 is the pair of pull requests ADR-023 exists because
of, and this table was the only file naming both. Five reproduction paragraphs now stand where the
table used to be the record.

**The cleanest run in the UIE chain, and the first ticket since ADM-06 to need no rework, no
consultation and no amendment.** One review pass, and **all four commands were run at REVIEW on the
final tree** — `tsc` 0, `eslint` 0, `vitest run` 186 in 10 files, `playwright test` 165 passed in
23.8s. The reviewer states in its own words that a verification table copied from the artifact being
judged is not evidence, and ran them itself.

**PLAN overrode §7 of this ticket's own shell, on the authority of a later document, and that is the
finding worth keeping.** §2 and §3 of the shell assume UIE-02 relocated the screens' selector ids
onto the shell. **It did not** — UIE-02 shipped `shell-period-*` names and left `data-period-kind` on
its anchor rather than `data-week-start` / `data-month` / `data-year`, deliberately, because while
both copies existed a reused id resolved to two nodes and Playwright's strict mode fails rather than
picking one. **UIE-02's `01-plan.md` § 4.8 handed the decision here in as many words**, so
`src/components/TopBar.tsx` and `src/lib/period.ts` came into scope against §7. Without that grant,
deleting four screen headers destroys **83 spec references**.

**Six spec files in `allowed_paths` — the most of any ticket in this product — and twelve paths is
M's ceiling exactly.** `tests/e2e/adm-01-threshold.spec.ts` is named in the shell specifically to be
**excluded**: it references two touched ids and both survive, so a reader who counts seven files
referencing a touched id knows why only six were edited. That is the shape of a scope statement that
expects to be checked rather than believed.

**`shell-period-prev`, `shell-period-next` and `shell-period-anchor` cease to exist three tickets
after UIE-02 named them.** Nothing asserts them, so the cost is documentary rather than behavioural —
but UIE-02's plan § 4.8 now reads as describing selectors that are gone. **That is what a superseded
plan looks like, and it is deliberately not amended backwards**, on the same principle every
corrected-in-place paragraph in this file follows.

**One open consequence, recorded by PLAN rather than fixed:** the holidays screen is now the only
period-shaped screen still carrying its own controls, which is a visible inconsistency inside a
ticket whose purpose was consistency. Teaching `period.ts` a `holidays` kind would close it in one
place, and that is a later ticket's.

**The window displaced `TEA-04` at this ship, the fourth row out and the third in three ships** —
*TEA-04, Remove a member, and promote a member to admin, shipped 2026-09-01,*
[#20](https://github.com/didi-code0980/calechip/pull/20). Reproduced on ADM-06's convention. **Four
reproduction paragraphs now stand between this table and the record it used to be**, and the question
first raised two ships ago has not changed: either the heading grows or something else becomes the
permanent record of what a ticket merged as. `metrics.md` has no PR column and cannot be it.

**`src/routes/Home.tsx` is deleted by this ticket** — the nav hub becomes the shell. **The twelve
`home-*` selector ids relocate UNRENAMED** into `Sidebar.tsx` and `TopBar.tsx`, which is what keeps
fifteen spec files passing unedited, and it is the reason this is M rather than L. Each of the 27 ids
was counted rather than asserted to have exactly one definition site, so nothing doubles under
Playwright's strict mode.

**One spec file is in `allowed_paths`, added at PLAN rework 1, and it is the only one this ticket
ever touches.** `tests/e2e/cal-03-admin-edit-entry.spec.ts:493` asserted **page-wide** that an entry
owner's display name is absent from a refusal screen — and the sidebar roster now names every active
member on every screen. The assertion is re-scoped to the content pane and its stated intent is kept
exactly: the roster is a read that *Read the member list* grants a member outright, so nothing is
disclosed that a policy withholds.

**Four statements in the shell went stale between triage and PLAN, and PLAN corrected each in place
rather than deleting it.** ADM-04, ADM-05 and ADM-06 are `DONE`, so §9.2's factual premise — *no route
is registered, no component exists* — is gone; **its conclusion survives for a different reason**, which
is that ADM-04 shipped its own link and that link relocates into the sidebar with the other eleven.
There are twelve `home-*` ids, not eleven. Fifteen spec files address one, not twelve — and §5 named
`cal-03-team-entries.spec.ts`, which does not exist. There are five membership guards on routes, not
four, and every line number in §3 is stale.

**One PLAN rework and one REVIEW rework, and only the second is charged.** PLAN rework 1 added the
spec file to `allowed_paths` and cost no `rework_count` — the defect was the plan's. REVIEW pass 1
(13:45) failed on §4.7's gutter, which is the Developer's, so `rework_count: 0 → 1` under RULE-08.
Pass 1's second finding was an AC-versus-code disagreement about `/week` addresses that the Developer
**routed rather than resolved** — both forms reach the same seven-day windows in the same order, so it
was a contract question and not a bug; `tech-lead-design` closed it at 14:20.

**The product shows two names, and this ticket makes a one-screen inconsistency a whole-product one.**
`index.html:6` and `CLAUDE.md` say *CaleChip*; UIE-01 built the auth card as *Ai Nghỉ?*; the sidebar
brand lockup now repeats that string on every screen. **§9.1 binds this ticket to whatever UIE-01
settled, so it followed rather than decided** — and it is one string in one file whichever way the
operator goes. `01-plan.md` *Open questions* item 1.

**The window displaced `TEA-03` at this ship, the third row it has pushed out** — *TEA-03, Team
member list, shipped 2026-09-01,* [#17](https://github.com/didi-code0980/calechip/pull/17). Content
reproduced on the convention ADM-06's ship established. **The question two ships ago called "two rows
old" is now three, and the interval between displacements is one ship**, which is what a rolling
window does once it is full. Either the heading grows or something else becomes the permanent record
of what a ticket merged as; `metrics.md` has no PR column and cannot be it.

**UIE-01 is the first `UIE` row to ship, and the first ticket in this product to deliver no
capability, no behaviour change and no test file at all.** OPS-001 and OPS-002 shipped no capability
but rewrote strings the suites assert on; this one changes appearance only. **Thirteen `data-testid`
names frozen and both acceptance suites passing unedited is what kept it at M rather than L** — rename
one selector and it becomes 5 source + 12 spec files, which is L and must split. That constraint is
written as AC-10 and asserted by AC-18.

**`size_estimate: S` against `size: M` is ADR-012 working, not a defect.** The whole gap is the six
`.woff2` files that `public/fonts/**` resolves to: an estimate that counts *surfaces* does not see
font binaries. The verdict wins and PLAN proceeded, which is the case that ADR's own *What this
decision does not change* names in so many words.

**One rework cycle, and the finding was the implementation's rather than the plan's** — so RULE-08
charges it, unlike OPS-002's amendment. REVIEW pass 1 (09:52) failed R5: the plan's vertical rhythm
specified 24px above the error paragraph and above the button, both shipped at `gap-4`'s 16px, and
the impl log had restated the contract row with those two values removed rather than declaring a
deviation. Pass 2 measured 24/24/24/24. **The correction went onto the shared constants rather than
onto the two screens**, so they cannot drift on a spacing value.

**One `TODO(project):` on this row is discharged by a decision and one is not.** The font: PLAN took
the self-hosted `@font-face` path — the only one of three needing no ADR — and the Developer obtained
six `.woff2` files rather than reaching for a CDN, so `requires_adr: false` is *true* rather than
merely unchanged. **The other stays open and is the operator's:** `§ Colour` and `§ Type` in
`.ai/standards/ui-design-system.md` are still bare stubs, so `src/index.css` is now the product's
de-facto palette and type scale **with no standard behind it**. UIE-02 is the next row and it has
nothing to conform to. Writing those two sections is human plane under RULE-01 and belongs to
`/thuki` on an `ops/<slug>` branch, not to a ticket.

**The window displaced `TEA-02` at this ship, the second row it has pushed out.** The heading says
*last 20* and OPS-002 is the twenty-first, so the oldest left the table. **Its content is reproduced
verbatim here, on the convention ADM-06's ship established one row earlier** — *TEA-02, Manage the
allow-list, shipped 2026-09-01,* [#13](https://github.com/didi-code0980/calechip/pull/13). The
paragraph below asks whether this heading should grow or whether something else should become the
permanent record of what a ticket merged as; **that question is now two rows old and still the
operator's.** It costs nothing until the day a reproduction paragraph is missed.

**OPS-002 empties the `copyDebt` ratchet, and that is the whole of what it delivers.**
`ui-language.json` goes from five files to `[]`. Twelve files predated `§ Language`; OPS-001
translated seven on 2026-09-03 and this ticket translated the last five, so the list reaching zero is
the standard's own stated proof that the sweep is complete. **The five leave the lint rule's `ignores`
and come under it**, which is what makes the ratchet unable to slip back — `eslint.config.js:84`
spreads `COPY_DEBT` into `ignores`, so an emptied list is an enforced list rather than a claim.
Adding a file to it is now the only way it can change, and that is the failure mode rather than the
mechanism.

**Its `feature_ids` span two groups and every one of the seven rows was already `DONE`**, so
`/ship` step 3 wrote nothing at all to `.ai/registry/features.md` — the first ship with no registry
write since that column got a writer. The split rationale item 6 requires is `ticket.yaml` §5: the
two seam implementations duplicate their refusal literals by design and `tests/seam-parity.test.ts`
compares export names and arity only, so cutting the pair by feature group would have left a
one-sided translation that is green against every check this project has.

**One amendment, no rework, and the defect was upstream.** `01-plan.md` AC-10 emptied `copyDebt`
while AC-12 assumed the two `it.each` cases over that list would go vacuous — and Vitest 4 fails a
suite that registers no tests. `tests/ui-language.test.ts` was not in `allowed_paths`, so the
`developer` could not reach the one file that resolves it, stopped, and routed it through
`99-questions.md`. `tech-lead-design` amended §7 and restated AC-12; `allowed_paths` went eleven to
twelve, **which is M's ceiling exactly, with no headroom left**. RULE-08: no `rework_count`
increment, because the plan was wrong rather than the implementation.

**The window filled at this ship, and `TEA-01` is the first row it pushed out.** The heading says
*last 20*; twenty rows stood here and ADM-06 is the twenty-first, so the oldest left the table. **Its
content is reproduced verbatim here so that nothing this file recorded is lost to a renumbering** —
*TEA-01, Sign up and establish the member record, shipped 2026-08-31,*
[#11](https://github.com/didi-code0980/calechip/pull/11) *merged 16:49:02Z; board and registry in*
[#12](https://github.com/didi-code0980/calechip/pull/12) *merged 16:50:48Z.* From here every ship
displaces a row, and a displaced row's links exist in no other file — `metrics.md` carries TEA-01's
five transitions and has no PR column. **A rolling window that quietly drops evidence is worth a
human's decision rather than a convention**: either this heading grows, or something else becomes the
permanent record of what a ticket merged as.

**OPS-001 is the first ticket that ships no capability at all** — it translates the copy of seven
already-shipped screens and changes no behaviour. Its five `feature_ids` are all TEA rows, and four
of the five were already `DONE`, so `/ship` step 3 had almost nothing to write.

**The exception is TEA-02, and it was stale rather than open.** That row read `IN_PROGRESS` with a
Notes sentence saying *"PR #13 open"*. [#13](https://github.com/didi-code0980/calechip/pull/13) merged
on 2026-08-31, hours after that sentence was written, and nothing updated the row for three days —
the exact silent drift `/ship` step 3 names as the reason it is the column's only writer. It is
corrected to `DONE` here, on the fact of the merge rather than on this ticket's work.

**Its `gates:` block was already correct** — `plan` and `review`, no `spec`, `design` or `qa`. First
ticket to reach `/ship` that way, because `product` created the shell on 2026-09-03 from the current
template. The five before it were each created before 2026-09-01 and each had to be migrated by
whichever role noticed.

**ADM-03 is the first ticket where the bounded-chat channel did the job it was built for, and the
first plan to be amended by the question rather than by its author noticing.** At 10:35 the
`developer` found that `01-plan.md` §4.5 and §7 were wrong: both asserted
`tests/e2e/adm-02-holidays.spec.ts` would pass **unedited**, and both reasoned about **selector names
only**. Every selector does keep its name — that part was right — but ADM-02's AC-13 signs in as an
admin and asserts **zero buttons, zero textboxes and zero forms** on `/holidays`, and five of this
ticket's criteria each require one of those three, for that caller, on that screen. The contradiction
is total, and it was **measured rather than predicted**: the full acceptance suite ran
`134 passed, 1 failed` with that one test as the only failure.

**What makes it worth recording is what the developer did next, which was nothing.** RULE-03 forbade
the edit, so they stopped, wrote `99-questions.md`, and routed it — the routing table sends *R5
impossible as specified* to `tech-lead-design`, which amended §4.5 and §7 at 10:45, scoped to that one
retired criterion, `size` 9 → 10 and still M. **RULE-08: no rework charged**, because the defect was
upstream of the stage that hit it. `chat_budget` `developer->tech-lead-design` is 1 of 6 — the first
non-zero chat count on the board.

**`allowed_paths` therefore grew from nine to ten between the DoR grade and the ship, which is
exactly what the forbidden thing looks like.** `.claude/commands/ship.md` says a path outside the list
is fixed by taking the file out of the commit, *"never to widen `allowed_paths`"* — that prohibition
is on `/ship` widening the list to get past its own step 6. This is the opposite: PLAN amended its own
plan, before the edit was made, through the channel the model provides for it. The distinction is
worth keeping legible, because the two are indistinguishable from the diff alone.

**AC-13 was retired where it stood, not reworded.** ADM-02's suite now carries a comment block naming
the ticket that superseded it and where the replacement assertion lives — ADM-03 AC-6, in both the
browser suite and the seam test. Its other eleven tests pass with no character changed.

**ADM-02 is the first ticket whose branch had to be merged with `main` before `/ship` could write
the board.** `feat/ADM-02` was cut from `2515a84`, one ship before CAL-07 merged as
[#53](https://github.com/didi-code0980/calechip/pull/53), so the `backlog.md` and `features.md` on it
were the pre-CAL-07 versions — no CAL-07 archive row, `Status: PLANNED`, and ADM-01's row back to
`PENDING_PR`. Writing this transition on that base would have opened a pull request that **reverts a
merged ticket's board and registry rows**, silently if anyone resolved the conflict the wrong way.
`origin/main` was merged in first; no incoming file was dirty, so it applied clean. Nothing in
`.claude/commands/ship.md` contemplates this case, and it will recur every time two ships run before
the first PR merges.

**It also means REVIEW's exit-0 evidence no longer described the tree being shipped.** The review ran
on the pre-merge tree — `vitest run` 4 files / 81 tests, which is the pre-CAL-07 count. After the
merge that tree does not exist. `/ship` step 1 is skipped by standing operator instruction, but the
reason for skipping it does not hold when the shipper changed the tree, so the three fast commands
were re-run here: `tsc --noEmit` exit 0, `eslint .` exit 0, `vitest run` **5 files / 110 tests, 0
fail**. `playwright test` was **not** re-run and remains REVIEW's, on the pre-merge tree.

**No new invariant and no foreign key.** ADR-015 settled on 2026-08-31 that the calendar is national,
closing `data-model.md` OPEN QUESTIONS items 1 and 2 — so `holiday` has no `team_id`, and `depends_on`
carries TEA-01 and ADM-01 rather than anything holiday-shaped. This is the first ticket in weeks whose
DoR item 4 passed on an ADR linked at `/triage` instead of one discharged at PLAN.

**The seed is data, not a capability.** `20260905120100_adm02_holiday_seed.sql` is idempotent with
`on conflict (date) do nothing` — `do nothing` and not `do update`, so an admin's correction from the
actual government announcement survives re-application. Applying it is human, RULE-09. `supabase/seed.sql`
carries four synthetic rows for local work and is deliberately not the real calendar.

**Its review is the second of three to catch the review-report template and the first to cite the
other.** `.ai/templates/review-report.md` still ships `next_state: QA`, a state ADR-022 removed;
ADM-01's reviewer corrected it, CAL-07's copied it through, and this one corrected it while naming
ADM-01's as precedent. Two of three is not a control — the template is.

**CAL-07 is the ticket CAL-04 was designed for, and the design held.** CAL-04's registry row
argued its absence function had to be **pure and take rows** — `absenceCountsFor(entries, range,
roster)`, every fetch outside it — for one reason stated in advance: *a function that fetches its own
rows cannot be called with an unsaved entry*, and CAL-07's whole job is the count a day will have
**if the draft in the form is saved**. This is that call. `src/lib/draft-entry.ts` turns the unsaved
draft into an `Entry` row and hands it to the same function, so the prospective count is CAL-04's
arithmetic rather than a second one — and `tests/absence.test.ts` and `tests/seam-parity.test.ts`
pass **unedited**, which is what plan section 5 stakes INV-04's single definition on. Third consumer,
one implementation.

**Its `depends_on` deliberately excludes ADM-01, and that call also held.** The triage shell recorded
that the idea bundled the warning with the threshold setting — *"cannot ship honestly without the
second"* — and rejected it as a release-ordering claim rather than a dependency, since
`overload_threshold` is `not null default 0.5`. ADM-01 shipped first anyway, so the argument was
never tested; what it bought was that it did not have to be.

**The review's `next_state` reads `QA`, a state ADR-022 removed.**
`.ai/templates/review-report.md` still ships that value. ADM-01's reviewer hit the same template
hours earlier and corrected it in the artifact, naming the staleness; this one copied it through. The
gate is `PASS` and the lifecycle at `.ai/01-operating-model.md:36` is authoritative, so the ship is
unaffected — but the template is still producing a retired state and that is steward work.

**Definition of Done item 3 was NOT run at `/ship`**: the operator instructed step 1 to be skipped.
The exit-0 evidence is REVIEW's, from 01:27 on the same tree with nothing committed since —
`vitest run` 5 files / 108 tests and `playwright test` 108 tests, 13 of them this ticket's.

**ADM-01 is the first ADM row to ship, and the first ticket whose PLAN gate had to be run twice.**
The 2026-09-03 pass came back `gate: BLOCKED` — it could not tell whether ADM-01 was allowed to carry
`grant select on public.team` and `team_select_own`, because `features.md` assigns those to CAL-04
and moving that ownership is a registry edit under RULE-01. Nothing was decided to unblock it. CAL-04
shipped the two statements on 2026-09-04, and the question stopped existing: the second pass on
2026-09-05 dropped the select half, linked ADR-005 and ADR-014 for the update half, and passed. **No
rework was charged** — RULE-08, the block sat upstream of the plan rather than inside it.

**What ships is two statements and a screen.** A column-level `grant update (overload_threshold) on
public.team`, which is what withholds `name` from everybody — an RLS policy is row-level and would
otherwise turn *set the threshold* into *edit the team row*, and no permission row for renaming a
team exists anywhere — and `team_update_admin`, scoped to an admin of the caller's own team. No
trigger, unlike TEA-04: one writable column needs no sentence that `with check` cannot express.

**The threshold was unreachable until now.** TEA-01 created `overload_threshold` and revoked every
privilege on `public.team`, so `0.5` was the only value the product could ever hold — and since
CAL-04 that default has been shading real days in the month view. This is the row that turns a
hard-coded 50% into a team's own number.

**Definition of Done item 3 was NOT run at `/ship`**: the operator instructed step 1 to be skipped.
The exit-0 evidence is REVIEW's, from 00:36 on the same tree with nothing committed since —
`vitest run` 4 files / 81 tests and `playwright test` 96 tests, both reproducing the impl log exactly.

**CAL-03 completes the write path on `entry`: CAL-02 gave a member their own rows, this gives an
admin every row on their own team.** Two policies and nothing else — `entry_update_admin` and
`entry_delete_admin`, both `using (is_admin(uid) and the entry's member is on the caller's team)`,
the update one additionally `with check` on team so an admin cannot move an entry to another team.
No new grant (CAL-02's are role-blind and already held), no insert policy, no change to
`entry_enforce_decision()`, and CAL-02's policies untouched. **Approving and rejecting is not here** —
that is ADM-05, and this row deliberately stops at edit and delete.

**Its `gates:` block still carried the four pre-ADR-019 keys — the fourth ticket running.** TEA-05
was migrated at PLAN, CAL-01 at `/implement`, CAL-02 and CAL-03 at `/ship`: four tickets, three
roles, none of them instructed to. Every remaining shell created before 2026-09-01 is the same.

**CAL-06 is the third view built on CAL-04's absence function, and the claim that function was made
for now holds.** CAL-04's registry row argued the return type had to be a per-date series rather than
a scalar precisely so *"the year view never needs a second path"*. This is that year view, and it
extended the shared module again — `src/lib/data/absence.ts` +46/-0, no second arithmetic. Three
consumers, one implementation.

**AC-14 refuses a possibly-truncated read rather than under-reporting it.** 365 days is where the
PostgREST row cap does its worst: a capped read sums what it was given and produces a believable
wrong answer with no error anywhere. The `TODO(verify)` on the datastore's own `max-rows` is carried
forward rather than assumed away, and it is still owed.

**First ticket in seven whose `gates:` block needed no migration.** The unstarted shells were fixed
between CAL-05's ship and this one, so CAL-07, CAL-08, the six ADM rows and OPS-002 all carry the
correct two keys. The shells still holding `spec`/`design`/`qa` are all DONE, which ADR-022 keeps on
purpose.

**CAL-05 is the first consumer of CAL-04's shared absence function, and it extended it rather than
copying it.** `src/lib/data/absence.ts` gained 74 lines and lost 1; no second arithmetic was written.
That is the outcome CAL-04's registry row demanded and the one no test would have caught failing —
two copies pass the seam-parity check, agree with each other, and diverge only when one is edited.

**`schema_delta` was genuinely `none`, the second ticket running.** CAL-02, CAL-03 and CAL-04 each
arrived with Definition of Ready item 4 failing and had it discharged at PLAN by linking existing
ADRs. CAL-05 owed none: the schema it reads was already shipped, and PLAN did not discover otherwise.

**Eight `allowed_paths` and the diff was eight for eight**, with real headroom — unlike CAL-04, which
sat exactly on the split threshold.

**CAL-04 builds INV-04 rather than merely touching it.** The absence-count function is one pure
function in one shared module — `src/lib/data/absence.ts` — imported by both seam implementations and
reimplemented in neither, which is what the registry row demanded: two copies of that arithmetic
would agree until one was edited, and INV-04 would be violated with every test still green. It is
range-shaped, returning a per-date series rather than a scalar, so CAL-06's year view needs no second
path and CAL-07's warn-once-versus-warn-per-day question is settled by the return type.

**It also ships the `team` select policy and grant that ADM-01's plan asked to take.** #45 settled
that question two hours earlier — CAL-04 keeps it, because the registry's own rule is that the owner
should be the first consumer. This ticket is that first consumer, so `overload_threshold` is readable
for the first time and INV-04 is computable at all.

**Twelve `allowed_paths`, and the diff was twelve for twelve** — no path unused, none exceeded.
`size: M` was annotated *"exactly on the split threshold"*, and it held.

**CAL-02 is the first ticket to ship under ADR-023 — one pull request, not two.** The three
ship-owned paths (`backlog.md`, `metrics.md`, `features.md`) ride on the ticket branch, exempted by
name in `scripts/check-allowed-paths.mjs`. The three ships before it — BUG-001, TEA-05, CAL-01 — each
produced two pull requests that had to be merged together, and #29 merging before #30 is the
demonstration ADR-023 cites.

**Its `gates:` block still carried the four pre-ADR-019 keys and nobody had migrated it.** Third
ticket running, and a different role did it each time — `tech-lead-design` at PLAN for TEA-05,
`developer` at `/implement` for CAL-01, `orchestrator` at `/ship` here, none of them instructed to.
Every remaining shell created before 2026-09-01 carries the same four keys.

**Definition of Ready item 4 failed at BACKLOG and was discharged at PLAN by linking rather than
authoring.** `schema_delta` is not `none` — two policies, a column-scoped update grant excluding
`member_id`, `status` and `rejection_reason`, a delete grant, and a `create or replace` of the
INV-02 trigger — and PLAN linked ADR-005, ADR-014 and ADR-016, all already approved, then corrected
`requires_adr` from `false` to `true`.

**CAL-01 is the first ticket to ship a migration, and the first whose invariants are enforced by the
database rather than by code.** Five of the seven are touched — INV-01 by an exclusion constraint
over `date_range` (needing the `btree_gist` extension), INV-02 by a trigger, INV-03 by a check, and
INV-06 and INV-07 by the table's own shape. ADR-005 and ADR-011 are the linked decisions; ADR-014 is
why `schema_delta` could not be `none`. **One implement cycle, no rework, R1–R8 all PASS.**

**All four verify commands were re-run at REVIEW and exit 0** — typecheck, lint, `vitest run`, and
`playwright test` with 32 passing, which is this ticket's eleven plus the four earlier suites
unedited. `/ship` did not re-run them; the operator instructed step 1 to be skipped.

**TEA-05 completes TEA-01, and both feature rows go to `DONE` together.** TEA-01 delivered sign-up
only; the sign-in half was carved out at DESIGN on 2026-08-31 and reached a ticket a day later
(MD-017). `.ai/board/tickets/TEA-01/01-story.md:212` says the feature is delivered only when both
halves are DONE, so `/ship` step 3's singular *"this feature's `Status`"* is read as plural here —
the instruction predates any ticket carrying two `feature_ids`.

**TEA-05 carries a `qa` gate reading `FAIL`, and it is not a waiver.** `06-test-report.md` failed on
2026-09-01 because the end-to-end suite was unpinned and ran against the live Supabase project —
that is BUG-001, archived directly above, which shipped the same day this did. ADR-022 then removed
the QA stage, so nothing produces that gate any more. Cycle 2 re-ran all four commands on 2026-09-03
at exit 0, including `pnpm exec playwright test` with 21 tests. **One rework cycle**, and
`rework_count` was corrected from 0 to 1 at ship; nothing had incremented it.

**AC-3 and AC-8 have never been observed against a real Supabase project**, which `01-plan.md`
section 8.1 declares as the plan's own limit rather than a gap the implementation opened. MD-014 is
the standing proof that the difference is not theoretical: seeded accounts could not sign in at all,
and no test noticed for a day.

**TEA-01 shipped with its QA gate passed by operator waiver.** Ten of twelve acceptance criteria
have no test; `tests/permission-model.test.ts` does not exist because no database was provisioned.
Under ADR-005 the row-level policies are the entire authorization model, so what is unverified is the
authorization model. The waiver is marked `temporary: true` in `06-test-report.md` and is reversed by
deleting the `waiver:` block. The work that retires it honestly is *Appendix A* of `02-design.md`.

**TEA-02 shipped with its QA gate waived per ADR-017.** Acceptance criteria and policy enforcement
are untested by automated suites because no live test runner is configured.

**TEA-03 and TEA-04 shipped with their QA gates waived per ADR-017**, on the same terms. No test
plan, no test report and no test file exists for either.

**TEA-04 IS THE THIRD TICKET TO REACH DONE UNDER ADR-017, WHICH FIRES ITS REVERT CONDITION 2** —
*"Three tickets reach DONE under this waiver"*, counted from `metrics.md` archive rows. TEA-02,
TEA-03 and TEA-04 are the three. Reverting is registry work under RULE-01 and belongs to the
steward, not to `/ship`: ADR-017's `Status` becomes `SUPERSEDED`, *The QA stage is waived* comes out
of `.ai/01-operating-model.md`, and a ticket opens to retire the untested surface. Under ADR-005 the
row-level policies are the entire authorization model, so that surface is the authorization model
across three tickets. Nothing counts this automatically — MD-016.

**TEA-03 shipped with its QA gate waived per ADR-017.** Acceptance criteria and policy enforcement
are untested by automated suites because no live test runner is configured.

**`Blocked on` for ADM-01 gained CAL-04 by `orchestrator` on 2026-09-04, and no row moved.**
Bookkeeping plus one resolved decision, not a reordering. `.ai/board/tickets/ADM-01/01-plan.md`
carried `gate: BLOCKED` on a single question — whether ADM-01 ships the `team` select policy and
grant that `.ai/registry/features.md` assigns to CAL-04. **The operator delegated the answer and it
is no.** The plan's premise had gone stale: it argued from ADM-01 being backlog row 1 and CAL-04 row
7, and today CAL-04 is row 1 and ADM-01 is row 4, because CAL-01, CAL-02 and CAL-03 shipped and left
this table. The registry's own reason for the assignment — the owner should be the first consumer, so
the policy is exercisable at its own gate — therefore points back at CAL-04, which is who it already
names. **`.ai/registry/features.md` is unedited, because nothing in it is wrong.** ADM-01's plan must
be re-run to clear its gate; the read half its sections 4, 6 and 7 marked for striking is struck.

**ADM-05 is the fourth ticket running to reach `/implement` still reading `BACKLOG` with both gates
`false`, and ADM-04's own metrics row predicted it in terms** — *"Steward work, and it will recur on
ADM-05 unless something is given the write."* It recurred. No command in `.claude/commands/` owns the
PLAN -> READY transition: the loop at `.ai/01-operating-model.md:284-286` has it, `/next-ticket`
grades the Definition of Ready and writes no file **by design**, and `/ship` is where `state`,
`branch` and `gates.plan` are finally recorded. Four occurrences with a standing prediction attached
is no longer a note for a ticket shell; it is a defect in the model with a named owner and no ticket.

**Two stale `PENDING_PR` markers were corrected at this ship, on the fact of the merge rather than on
this ticket's work** — the same repair OPS-001's ship made to TEA-02, and for the same reason `/ship`
step 3 gives for being the column's only writer. ADM-04's archive row above and its `features.md` row
now carry [#58](https://github.com/didi-code0980/calechip/pull/58); CAL-08's `features.md` row now
carries [#56](https://github.com/didi-code0980/calechip/pull/56), which this table already had. Both
were written by a ship that could not know its own number, which is the structural cause: `/ship`
commits before it opens the pull request, so the row is true only if something comes back for it.

**This ship came back for its own, and that is the whole of the second commit on this branch.**
`git push --force` is denied in settings (`git-conventions.md`, *Two limits are not the
orchestrator's to weigh*), so amending was not available and the number could not have been known
one commit earlier. `.claude/commands/ship.md` says a ticket gets one commit; `git-conventions.md`
§ *What the orchestrator decides* leaves the count to the orchestrator. **ADR-023's invariant is one
pull request, not one commit**, and #59 is one pull request. The second commit touches two
ship-owned files and changes two strings. **The general fix is still owed and is not this**: either
`/ship` learns to write the row after `gh pr create`, or a check fails a `PENDING_PR` marker on a
ticket whose branch has an open pull request.
