// SOLO, 2026-09-09 — the admin area's layout route element.
//
// **IT IS A LAYOUT ROUTE'S `element`, NOT A WRAPPER AND NOT A `useLocation()` CONDITIONAL**, which
// is the same choice `AppShell.tsx` records in its own header and for the same reason: a component
// that decides *am I on an admin screen* by reading the pathname is the route table re-expressed as
// an if-statement, in a file that already uses the router for exactly this distinction. That
// condition then has to be extended by hand every time an admin screen is added, and the failure is
// SILENT — a new admin address simply appears without the strip. Here the router decides, and adding
// the sixth admin screen means putting its `<Route>` inside one of the blocks in `App.tsx`.
//
// **THE STRIP IS DRAWN ONLY FOR AN ADMIN, AND THAT IS NOT A CONTROL.** Drawn for everybody it would
// hand a member a list of the five administrative addresses on every screen that refuses them —
// which is precisely what UIE-10 AC-1 removed from the sidebar, for both roles, four days ago. The
// destinations refuse a member either way (`allow-list-refused`, `team-entries-refused`,
// `threshold-refused`, `pending-entries-refused`, `member-list-not-on-a-team`); hiding the strip
// saves a pointless journey and refuses nobody, which is UIE-02's sentence about the same property.
//
// **`isAdmin` IS A BOOLEAN AND NOT THE `Member`**, the fourth alternative UIE-09 § 8 rejected: the
// one question this component has is *may this person administer*, a boolean answers it, and a
// `Member` prop invites the layout to grow a second reason to hold a member row. `App.tsx` computes
// the expression in the file that already holds the row, exactly as it does for `TopBar`.
//
// **(Superseded 2026-09-26.) THIS COMPONENT MAKES NO SEAM CALL AND HAS NO STATE.** It re-reads
// nothing, so it adds no phase to any screen below it. Each of the six destinations keeps its own
// loading, refusal and failure states untouched — including `/admin` itself, whose four phases
// `AdminHub.tsx` still owns.
//
// **SOLO, 2026-09-26 (second run) — IT NOW MAKES EXACTLY ONE SEAM CALL, AND THE PARAGRAPH ABOVE IS
// KEPT AS THE RECORD OF WHAT IT COST TO GIVE UP.** The operator asked for the number of reports not
// yet done to appear on the navigation tab. That number has to be read somewhere, and every other
// candidate is worse:
//   * `AdminTabs` reading it would put a seam call, a loading state and a failure path on a
//     presentational component whose whole documented value is having none — the fence UIE-09
//     `01-plan.md` § 1 put up, which still stands;
//   * `IssueReports.tsx` reading it cannot work, because the badge has to be right on the seven
//     admin screens that are NOT `/reports`;
//   * `App.tsx` reading it would put an admin-only read above the router, on every page in the
//     product including the calendar, for a number only the admin strip draws.
// So it is here: the one component that exists exactly where the strip does and nowhere else.
//
// **WHAT THIS DOES NOT COST.** It adds no phase to any screen below: each count starts `null`, the
// strip draws no badge for `null`, and the outlet renders immediately either way. A failed read
// leaves that one `null` for ever, which draws nothing — a badge is the one thing whose absence is a
// safe answer, and both count functions throw rather than returning a confident `0`.
//
// **SOLO, 2026-09-26 (third run) — IT NOW MAKES TWO, on the operator's instruction to put the same
// number on the `New sign-ups` tab.** The argument above is unchanged by the second one and would be
// unchanged by a third: the reads belong wherever the strip is, the strip is here, and each badge
// fails on its own rather than as a pair.
//
// **MIR-17, ADR-088 — BACK TO ONE.** `countOpenIssueReports()` is gone with the *Reports* tab it
// badged: since MIR-16 an org admin reads no report at all (ADR-082 decision 1), so there is nothing
// left for that read to tell this layout. `refreshBadges` now reads `countPendingMembers()` only.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useOutletContext } from "react-router-dom";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `@/lib/data/supabase` or `@/lib/data/mock` (RULE-02).
import { seam } from "@/lib/data";
import type { MemberRole } from "@/lib/domain/types";
import { mayAdminister, mayDecide } from "@/lib/roles";
import AdminTabs, { type AdminBadge } from "./AdminTabs";
import type { ShellContext } from "./AppShell";

/**
 * SOLO, 2026-09-26 (second run). What a screen INSIDE THE ADMIN AREA may ask of the layout above it,
 * on top of everything `ShellContext` already offers.
 *
 * **ONE ENTRY, AND IT IS THERE FOR THE SAME REASON `refreshMembership` IS**: a screen writes
 * something that a component it does not own is rendering, and there is no other way to say so. A
 * screen that needs neither keeps calling `useShellContext()` and sees no difference — this type
 * extends that one rather than replacing it.
 */
export interface AdminContext extends ShellContext {
  /**
   * Re-reads the counts behind the tab badges.
   *
   * **ONE FUNCTION FOR BOTH QUEUES AND NOT ONE PER BADGE — SOLO, 2026-09-26 (third run).** It was
   * `refreshOpenReports` while one tab carried a count. A screen that has just written something
   * knows that A badge may be stale; making it also know WHICH would put the strip's arrangement
   * into every screen that writes. Both reads are one round trip each and neither is on a path
   * anybody waits for.
   */
  refreshBadges(): void;
}

/** The typed reader, beside `useShellContext`. An admin screen calls this one; every other screen
 *  keeps calling that one, so the shape grows one entry at a time rather than per caller. */
export function useAdminContext(): AdminContext {
  return useOutletContext<AdminContext>();
}

export interface AdminLayoutProps {
  /**
   * The signed-in caller's rank, or `null` when there is no member row. Resolved once in `App.tsx`;
   * never re-read here.
   *
   * **SOLO 2026-09-12, ADR-035 — THIS WAS `isAdmin: boolean` AND A BOOLEAN CAN NO LONGER ANSWER
   * IT.** The strip is now drawn for two ranks and carries different tabs for each, so the question
   * moved from *may this person administer* to *which of them is reading*. The header's argument for
   * a boolean — that a `Member` prop invites the layout to grow a second reason to hold a member row
   * — is answered by passing the RANK and not the row: it is one scalar, and there is nothing else
   * on it to reach for.
   */
  role: MemberRole | null;
}

export default function AdminLayout({ role }: AdminLayoutProps) {
  // **THE SHELL'S CONTEXT IS FORWARDED, AND A BARE `<Outlet />` IS WHAT MADE THAT NECESSARY.**
  // `useOutletContext` reads the context of the NEAREST enclosing outlet, so a nested layout that
  // renders `<Outlet />` with no `context` prop hands its children `null` — and every screen under
  // this layout is a child of THIS outlet, not of `AppShell`'s. Without this line
  // `useShellContext()` returns null on every admin address and only there, which is the worst
  // shape a defect can have: the same hook works on `/profile` and crashes on `/entries/team`.
  //
  // **IT FORWARDS, IT DOES NOT BUILD.** The object is the shell's own, passed through unchanged, so
  // there is still exactly one `ShellContext` in the application and this file adds no fact to it.
  // `THIS COMPONENT MAKES NO SEAM CALL AND HAS NO STATE` above is unchanged — a context read is not
  // a read of the datastore.
  const shell = useOutletContext<ShellContext>();

  // SOLO, 2026-09-26 (second run). `null` until a read answers, and `null` again never — a failed
  // read simply leaves it here, which draws no badge. See the header for why `null` and `0` are
  // different answers and why neither is guessed.
  //
  // MIR-17, ADR-088 — `openReports` is gone from this record with the tab it badged.
  const [badges, setBadges] = useState<Record<AdminBadge, number | null>>({
    openSignups: null,
  });

  /**
   * Reads the count, for an admin and nobody else.
   *
   * **THE ROLE TEST IS AN AFFORDANCE AND NOT THE CONTROL.** `member_select_pending_admin` answers a
   * member `0` anyway, because a filtering select policy counts nothing for them. This just avoids a
   * request that is certain to say zero, on every admin-addressed screen a manager can reach.
   *
   * MIR-17, ADR-088 — this read the reports count too, settled independently of the sign-ups one so
   * that one failing read could not blank the other tab's badge. `countOpenIssueReports()` is gone
   * with the *Reports* tab (MIR-16, ADR-082 decision 1), so there is now exactly one read and the
   * independence argument no longer applies to anything.
   */
  const refreshBadges = useCallback((): void => {
    if (role === null || !mayAdminister(role)) {
      setBadges({ openSignups: null });
      return;
    }

    // A THROW LEAVES ITS BADGE UNKNOWN RATHER THAN ZERO. A confident `0` on a read that failed is
    // the one wrong answer a badge can give — it says *nothing is waiting* about a thing nobody
    // asked.
    void seam
      .countPendingMembers()
      .then((openSignups) => setBadges((previous) => ({ ...previous, openSignups })))
      .catch(() => setBadges((previous) => ({ ...previous, openSignups: null })));
  }, [role]);

  // Once when the admin area is entered, which is when this layout mounts. It does NOT re-read per
  // tab: the layout stays mounted as an admin moves between the admin addresses, so a read per
  // navigation would be one request per tab for a number that cannot have changed in between.
  useEffect(() => refreshBadges(), [refreshBadges]);

  /**
   * **THIS LAYOUT NOW BUILDS A CONTEXT RATHER THAN ONLY FORWARDING ONE, AND THE NOTE BELOW IS WHY
   * THAT WAS WORTH DOING.** `IssueReports.tsx` marks a report done, and the badge two hundred pixels
   * above it would keep the old number until somebody left the admin area and came back. That is the
   * same defect `ShellContext.refreshMembership` exists for one layer up — a write that changes a
   * fact somebody ELSE is rendering, with no way to say so — and it is answered the same way.
   *
   * IT ADDS ONE ENTRY AND CARRIES THE SHELL'S OWN THROUGH UNCHANGED, so there is still exactly one
   * `member` and one `refreshMembership` in the application and this file invents neither.
   */
  const adminShell = useMemo<AdminContext>(
    () => ({ ...shell, refreshBadges }),
    [shell, refreshBadges],
  );

  return (
    // **THE ADMIN AREA'S MEASURE IS DECIDED HERE, ONCE.** It used to be decided six times: the tab
    // strip capped itself at `max-w-3xl`, three list screens at `max-w-3xl` and two at `max-w-2xl`,
    // so the strip visibly overhung the card beneath it on `/members` and `/admin` and every new
    // admin screen had to guess a number. The screens keep their own narrow caps for the states that
    // WANT to be narrow — a refusal, a spinner, a form — and only the ready list fills this column.
    //
    // `max-w-6xl` and not full bleed: these are tables of six or seven columns, and a row stretched
    // across an ultrawide monitor separates the name from its buttons by half a metre of nothing.
    // `.ai/standards/ui-design-system.md` names no content width, so this is a choice and not a
    // citation — it is one token, in one file, and changing it moves the whole admin area together.
    <div className="mx-auto w-full max-w-6xl">
      {role !== null && mayDecide(role) ? (
        <AdminTabs role={role} badges={badges} />
      ) : null}
      <Outlet context={adminShell} />
    </div>
  );
}
