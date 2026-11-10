// SOLO, 2026-09-12 — ADR-035. The two questions the interface asks about a role, asked in one place.
//
// **THESE ARE AFFORDANCES AND NOT CONTROLS (ADR-005).** What stops a manager maintaining the holiday
// calendar is `public.is_admin` inside the policies; what stops them rewriting somebody's entry while
// approving it is clause (a2) of `public.entry_enforce_decision()`. Everything here decides which
// controls to DRAW, and deleting the whole file would change no permission.
//
// **THEY EXIST BECAUSE `role !== "admin"` STOPPED BEING A COMPLETE TEST.** With two ranks it meant
// *an ordinary member*; with three it silently admits a manager. A predicate with a name makes the
// call site say which of the two questions it is asking, and there are exactly two.
//
// ABOVE THE SEAM AND IMPORTING ONLY DOMAIN TYPES, so RULE-02 and the `supabase-client-in-seam`
// boundary are untouched.
import type { Member, MemberRole } from "@/lib/domain/types";

/**
 * May this person administer — the holiday calendar, the roster, the threshold, the sign-up queue,
 * the team list, and editing or deleting anybody's entry.
 *
 * `public.is_admin` reproduced. **It must stay `=== "admin"` exactly**: every power a manager does
 * not have is denied by that helper continuing to mean one role, and ADR-035 § *Consequences* names
 * widening it as the most likely wrong "fix" a later reader will reach for.
 */
export const mayAdminister = (role: MemberRole): boolean => role === "admin";

/**
 * May this person decide an entry — approve or reject one.
 *
 * `public.may_decide` reproduced, minus the two conjuncts a `Member` in hand has already satisfied:
 * the seam returns no row for a caller who is not `approved`, and `removedAt` is checked by the
 * callers that hold a full `Member` (see `mayDecideEntriesOf` below).
 *
 * **IT SAYS NOTHING ABOUT WHOSE ENTRY.** Whose entry was a fact about a PAIR, so it lived in the
 * function below; since ADR-073 decision 3 it is no longer a fact at all (see below).
 */
export const mayDecide = (role: MemberRole): boolean =>
  role === "admin" || role === "manager";

/**
 * May `me` decide the entry owned by `ownerId`?
 *
 * Clause (a) of `public.entry_enforce_decision()`, actor side: a decider, and not removed.
 *
 * MIR-14, 2026-11-03: **THE OWN-ENTRY CLAUSE LEFT WITH ADR-073 DECISION 3**, which supersedes
 * ADR-035 § *Decision* item 3. A manager may decide their own entry, and the database records it as
 * `self_approved`. `ownerId` is kept so no caller changes; it is unused until MIR-17 moves this check
 * onto `team_role`, where the owner's teams are what it will read. The per-team half of the rule
 * (`may_decide_entry`) and the rejecter's hold on their own rejection are the database's — the
 * client is the affordance (ADR-005).
 *
 * MIR-07, 2026-10-23: and `approved`, which is `public.may_decide`'s `status = 'approved'` clause
 * (`20260912100000_solo_manager_role.sql:55-64`). The mock hands this function full rows it holds,
 * not only the seam's answer for an approved caller, so the clause cannot be left to the caller.
 *
 * MIR-17, 2026-11-09: this is the mock's decider (`src/lib/data/mock.ts`) and nothing reads it
 * above the seam — the worklist decides per owner through `listEntryOwners` (ADR-090), not through
 * this function. `ownerId` stays unused for the reason given above, not because of anything MIR-17
 * changes.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `ownerId` is unused; see the comment above
export const mayDecideEntriesOf = (me: Member, ownerId: string): boolean =>
  me.status === "approved" && me.removedAt === null && mayDecide(me.role);

/**
 * The word for a role, in the interface's language.
 *
 * **ONE DECLARATION, and it was four.** `Sidebar.tsx`, `MemberList.tsx`, `Profile.tsx` and this
 * file's callers each carried a `role === "admin" ? "Admin" : "Member"` ternary — which is not merely
 * duplication but the exact shape ADR-035 had to hunt: every one of them labelled a manager
 * `Member`. Folded here for the reason OPS-002 AC-8 folded the three entry label sets.
 */
export const ROLE_LABELS: Record<MemberRole, string> = {
  member: "Member",
  manager: "Manager",
  admin: "Admin",
};

/**
 * SOLO 2026-09-13. The COLOUR of a role badge, and only the colour — each screen keeps its own size
 * and padding. Operator: admin in the product's primary purple, manager in yellow, member unchanged.
 * Displaying a role grants nothing, the same as `ROLE_LABELS` above.
 */
export const ROLE_BADGE_COLORS: Record<MemberRole, string> = {
  member: "bg-field text-ink-2",
  manager: "bg-amber-100 text-amber-800",
  admin: "bg-primary text-white",
};
