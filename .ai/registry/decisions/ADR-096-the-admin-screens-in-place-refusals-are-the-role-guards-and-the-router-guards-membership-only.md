---
doc_version: 3
last_updated: 2026-11-11
governed_by: [RULE-01, RULE-02, RULE-04]
---

# ADR-096 — The admin screens' in-place refusals are the role guards, and the router guards membership only

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-11 — at `/plan MIR-17-g` (ADR-008, ADR-067).

This ADR answers the question ADR-089 *Context* and ADR-094 decision 3 left to MIR-17-g. It
reverses no accepted decision: it confirms the design `src/App.tsx` already records, and pins it.

## Context

Counted on 2026-11-11 at `origin/main` `2aad301` (MIR-18-c shipped).

- **P4-2's last bullet** (`.ai/board/plans/calechip-multi-tenancy-plan.md:244`) reads *"Router has
  no role guards at all; add them"*. That is true of the router. It is not true of the product.
  `src/App.tsx` puts eleven paths under the four `AdminLayout` route blocks. Six of them name a
  screen that refuses a caller in place:

  | Path | Screen | Asks | Refusal |
  |---|---|---|---|
  | `/signups` | `NewSignups` | `mayAdminister` | `signups-refused` |
  | `/entries/team` | `TeamEntries` | `mayAdminister` | `team-entries-refused` |
  | `/entries/pending` | `PendingEntries` | `mayDecide`, then the `owners` read | `pending-entries-refused` |
  | `/setting` | `Threshold` | `mayAdminister` | `threshold-refused` |
  | `/teams` | `Teams` | `mayAdminister` | `teams-refused` |
  | `/admin` | `AdminHub` | `mayAdminister` | `admin-hub-refused` |

  Since MIR-17-b (ADR-089 decision 1), every one of those asks a role helper.
- **The other five are not admin screens.** A route guard on them would be wrong:
  - `/members`: every signed-in role reads the roster (TEA-03; `Read the member list`, member ✅);
  - `/holidays` and `/holidays/:year`: `Read the holiday calendar` is checked for both roles;
  - `/reports`: every role is told where reports go (MIR-17 AC-3, `issue-reports-moved`);
  - `/threshold`: a redirect to `/setting`.
- **The router's guards are written on purpose, and each says why.** The comments at `/entries/team`,
  `/entries/pending`, `/setting`, `/reports` and `/admin` each say the route is guarded on `member`
  and not on `admin`, *"because the refusal is what says why"*. A redirect leaves somebody who
  mistyped nothing to read.
- **The router cannot answer `/entries/pending`.** Since ADR-090 decision 1, `PendingEntries` admits
  a caller without a deciding rank when `listEntryOwners` names a row they may decide. That fact is a
  read the screen makes. The router holds `membership.member.role` and nothing else. A role guard
  there would refuse a second-team decider whom the screen admits.
- **Every guard here is an affordance** (ADR-005). The controls are the policies and the definer
  functions behind each screen's reads and writes. Moving the check to the router would change what
  is drawn, not what anyone can do.
- **Interception would move 23 references across 10 spec files** that address the six
  `*-refused` elements (grep `"(admin-hub|signups|threshold|teams|team-entries|pending-entries)-refused"`
  in `tests/e2e/`).

## Decision

1. **The six screens' in-place refusals are the role guards.** The router guards membership only:
   it keeps a signed-out or member-less caller off an address, and the screen answers the rank
   question with a sentence.
2. **The router asks no rank question.** `src/App.tsx` imports nothing from `@/lib/roles` and calls
   neither `mayAdminister` nor `mayDecide`.
3. **The classification is pinned by a source-text test**, `tests/route-role-guards.test.ts`
   (MIR-17-g). Every path under an `AdminLayout` block is either a refusing route, whose screen asks
   its helper and renders its refusal, or a named open route. A new path under `AdminLayout` that is
   in neither list fails the test. That is the failure P4-2's bullet was worried about: an admin
   address nobody guards.
4. **`src/App.tsx` records this decision** in one comment above the first `AdminLayout` block, citing
   this ADR.

## Options considered

- **A `RequireRole` route wrapper that redirects to `/`.** Rejected:
  - it drops the refusal's sentence;
  - it refuses a second-team decider at `/entries/pending` (ADR-090);
  - it moves 23 references in 10 files, which makes the ticket `L`.
- **A wrapper that renders one shared refusal.** Rejected. It replaces six refusals, each with its own
  copy and selector, with one. It moves the same assertions, and it still cannot answer
  `/entries/pending` without the screen's read.
- **A wrapper that calls the same helper and then renders the screen, which refuses again.**
  Rejected. That is two checks of one question, and the two can drift apart. The wrapper adds nothing
  the screen does not already do.
- **Record the decision in prose only.** Rejected. Prose does not stop the next admin address from
  being added without a refusal. The test does.

## Consequences

- P4-2's last bullet is closed by this decision, not by new router code. MIR-17's feature row can
  close once MIR-17-g ships.
- Adding an admin screen now means adding its path to one of the test's two lists. A refusing screen
  must ask a helper and render a `*-refused` element.
- No e2e spec changes, and no role sees a different screen.

## Revert condition

An admin screen whose first read would show a non-admin something before the screen can refuse,
which means the screen cannot refuse in place without leaking. That route then gets a router guard,
and the test's list says so.
