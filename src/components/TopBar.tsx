// UIE-02 — the top bar. 01-plan.md § 4.3, § 4.8 and § 4.9.
//
// **IT TAKES ONE PROP, AND THE PROP IS A ROLE.** UIE-09 § 4.2 amends UIE-02's *IT TAKES NO PROPS*,
// which read: *the anchor, the previous and next targets and the active segment are all derived from
// the pathname. No context, no upward prop path, no `useOutletContext` — 01-plan.md § 4.3 in as many
// words.*
//
// **WHAT THAT SENTENCE WAS PROTECTING STILL HOLDS, AND ITS REAL SUBJECT IS THE PERIOD DERIVATION.**
// The anchor, the step controls, `Today` and the three switcher segments still come from
// `periodNavFor(useLocation().pathname)` and from nothing else — see the paragraph below, which is
// the one that says why. What `isAdmin` carries is a ROLE, which is not derivable from a pathname by
// any means and which this component had no way to obtain: it holds no session and makes no seam
// call, so `AppShell` — which already has the member row `App.tsx` resolved — computes the
// expression and passes the answer. A reader who finds the bold sentence gone must be able to see in
// the same paragraph that the invariant it was protecting is untouched; this is that paragraph.
//
// **IT READS `useLocation().pathname` AND NOT `useParams()`, AND THAT IS LOAD-BEARING.** This
// component is rendered by the LAYOUT route, which sits ABOVE the matched child route, so its own
// `useParams()` sees no `:day`, `:month` or `:year` — it would return `{}` on every period screen
// and the cluster would silently never render. 01-plan.md § 4.5 names this as the single most
// likely way to build this bar and have it draw nothing.
//
// **IT HOLDS NO CLOCK.** `shell-period-today` points at the ANCHORLESS address — `/week`, `/month`,
// `/year` — so the screen resolves what day it is from the caller's own clock, which is where the
// three existing local date reads live and where they stay (01-plan.md § 8, rejected alternative 4).
// An absent or malformed anchor draws no cluster at all (AC-15, AC-16): the screen's own redirect
// arrives one render later, and guessing would make the shell disagree with the screen for a frame.
//
// **UIE-03 TOOK THE DECISION § 4.8 LEFT OPEN, AND THE PERIOD IDS ARE THE SCREENS' OLD ONES.** The
// superseded paragraph read *NONE OF THESE IDS IS A SCREEN'S* — true for exactly one ticket, while
// the screens still rendered their own headers and reusing `week-prev` here would have resolved a
// strict locator to TWO nodes. UIE-03 deleted those four headers, so there is now exactly one copy
// of each name and it is this one. The anchor, the step controls and the switcher segments are
// named from `nav.kind` — `week-anchor`, `month-prev`, `year-month` — which is what keeps 83
// assertions across the calendar specs passing without being rewritten (UIE-03 01-plan.md § 4.3).
//
// `shell-topbar`, `shell-period-today` and `home-new-entry-link` keep their names: nothing on a
// screen was ever called those, so there was nothing to adopt (UIE-03 AC-14).
//
// EVT-04 § 4.5. This bar still makes no seam call; `<NotificationBell />` is a child that does, as
// `ReportIssueButton` does beside the shell.
import { Link, useLocation } from "react-router-dom";
import { ListTodo } from "lucide-react";
import NotificationBell from "./NotificationBell";
import type { MemberRole } from "@/lib/domain/types";
import { mayAdminister, mayDecide } from "@/lib/roles";
import { isAdminAddress } from "./AdminTabs";
import { periodNavFor, type PeriodKind } from "@/lib/period";
// CAL-12 § 4.6. The bar's period links are built from the pathname and would drop `?team=`; each now
// carries it across (AC-7), and the new-entry link is absent while another team is viewed (AC-9).
import { useViewedTeam } from "@/hooks/useViewedTeam";
import { isReadOnly, withTeamParam } from "@/lib/viewed-team";

const ICON_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-pill text-lg leading-none text-ink-2 " +
  "transition-colors hover:bg-card hover:text-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

// SOLO, 2026-09-12. **EXPORTED**, so `src/routes/Profile.tsx` draws its `Calendar` control from
// this string rather than from a second copy of it. A copy is what UIE-06 § 1 describes going wrong
// one layer down — the legend and the grid it explained were painted from two different palettes,
// side by side, permanently — and a pill that drifted from the top bar's would be the same defect in
// shape instead of colour. It is a class string and not a component: there is one control at the far
// end, and a `<PillLink>` for one caller is a layer with nothing in it.
export const PILL_OUTLINE =
  "rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 " +
  "transition-colors hover:border-ink-3 hover:text-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

// AC-14, and § 4.9's "never by colour alone": the active segment is distinguished by FILL, by
// WEIGHT and by `aria-current="page"` — which is the one of the three a screen reader gets.
const SEGMENT_BASE =
  "rounded-pill px-3 py-1 text-xs transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const SEGMENT_ON = "bg-card font-bold text-ink shadow-soft";
const SEGMENT_OFF = "font-semibold text-ink-3 hover:text-ink-2";

const segmentClass = (on: boolean): string =>
  `${SEGMENT_BASE} ${on ? SEGMENT_ON : SEGMENT_OFF}`;

// The nav pills — Tasks, Admin, Events. The one for the current area is FILLED and carries
// `aria-current="page"`; the others keep `PILL_OUTLINE`, so the active one is told by fill and by
// the attribute, never by colour alone.
const NAV_PILL_ON =
  "rounded-pill border border-ink bg-ink px-3 py-1.5 text-xs font-bold text-white " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const navPillClass = (on: boolean): string =>
  `inline-flex items-center gap-1.5 ${on ? NAV_PILL_ON : PILL_OUTLINE}`;

export interface TopBarProps {
  /** The signed-in member's rank. The bar has no session and no seam call of its own, so the answer
   *  arrives from `AppShell`, which already holds the member row — UIE-09 § 4.3.
   *
   *  **SOLO 2026-09-12, ADR-035 — THIS WAS `isAdmin: boolean`.** § 8's rejected alternative 4 was a
   *  `Member` prop, on the ground that a row here invites a second reason to hold one; a RANK is not
   *  that. It is one scalar with nothing else on it to reach for, and the bar now has two questions
   *  rather than one — *may this person decide* chooses whether to draw the control, *may this person
   *  administer* chooses where it points. A boolean cannot carry both. */
  role: MemberRole;
}

export default function TopBar({ role }: TopBarProps) {
  const { pathname, search } = useLocation();
  const nav = periodNavFor(pathname);
  const { viewed } = useViewedTeam();

  // SOLO, 2026-09-11. **THE ONE CONTROL HAS TWO FACES, AND WHICH ONE IS SHOWING IS A FACT ABOUT THE
  // ADDRESS.** Standing on any admin screen it is the way back to the calendar; standing
  // anywhere else inside the shell it is the way in. `isAdminAddress` is the list the tab strip
  // already renders from — `AdminTabs.tsx` records why the pathname is what answers this here and
  // why the router cannot.
  const onAdmin = isAdminAddress(pathname);
  const onEvents = pathname === "/events" || pathname.startsWith("/events/");
  const onTasks = pathname === "/tasks" || pathname.startsWith("/tasks/");

  // UIE-03 § 4.3. No `testId` field any more: a segment's name depends on WHERE IT GOES *and*
  // WHERE IT IS — `week-month` from a week, `month-week` from a month — so it is `<nav.kind>-<kind>`
  // computed at render, below. Six of the nine names the rule yields are the ones the screens' own
  // cross-view links carried; the other three — `week-week`, `month-month`, `year-year`, the
  // segment pointing at the view you are already on — plus `year-week`, which UIE-02 § 4.8 declined
  // to create and which the rule yields anyway, are referenced by nothing. § 2 *Open questions* 1
  // and 2 accept those four as the price of a rule with no special case for the active segment.
  //
  // **THE GROUP NOW RENDERS ON EVERY SHELL SCREEN.** Off a period screen there is no `nav`, so the
  // targets fall back to the anchorless addresses — which resolve to today — no segment is active,
  // and the name is `shell-<kind>`.
  const segments: readonly {
    kind: PeriodKind;
    label: string;
    to: string;
  }[] = [
    { kind: "week", label: "Week", to: nav?.weekTo ?? "/week" },
    { kind: "month", label: "Month", to: nav?.monthTo ?? "/month" },
    { kind: "year", label: "Year", to: nav?.yearTo ?? "/year" },
  ];

  return (
    // § 4.9. Spans the CONTENT PANE only and not the sidebar — it is rendered inside that pane —
    // ~70px tall, on `--color-bg` with no card behind it. `shrink-0` so it keeps its height when the
    // pane below it scrolls.
    <header
      data-testid="shell-topbar"
      className="flex h-[70px] shrink-0 flex-wrap items-center gap-3 px-6"
    >
      {/* AC-15. The whole left cluster is ABSENT on a route that has no
          period — `/allow-list`, `/entries/new`, `/setting` and the rest. Absent, not disabled:
          a disabled previous-period control on a screen with no period asserts that a period exists
          and is merely unavailable. `shell-topbar` and `home-new-entry-link` still render. */}
      {nav !== null ? (
        <>
          {/* AC-12. Links and not buttons, the choice the period screens already made: the period
              IS the address, so moving between them is navigation and a member can bookmark or
              share the week they are looking at. */}
          <Link
            data-testid={`${nav.kind}-prev`}
            to={withTeamParam(nav.prevTo, search)}
            aria-label="Previous"
            className={ICON_BUTTON}
          >
            &lsaquo;
          </Link>

          {/* UIE-03 AC-6. **The label is not the anchor, and only one of the two is asserted.** The
              bar goes on rendering `nav.label` — `1 Dec – 7 Dec 2025` — where the week screen's own
              `h1` read `Week of 2026-10-05`; that difference is safe because all 43 spec references
              to these anchors read a `data-*` attribute and none reads the text (§ 0 measurement 2).

              THE THREE ATTRIBUTES ARE MUTUALLY EXCLUSIVE BY KIND and the two that do not apply are
              `undefined`, which React omits from the DOM entirely — so a month anchor carries
              `data-month` and no empty `data-week-start` beside it. Writing them as three fixed
              attributes rather than one computed key keeps the names greppable, which is how a
              reader finds what a spec is reading. `data-period-kind` is UIE-02's and is kept. */}
          <p
            data-testid={`${nav.kind}-anchor`}
            data-period-kind={nav.kind}
            data-week-start={nav.kind === "week" ? nav.anchorValue : undefined}
            data-month={nav.kind === "month" ? nav.anchorValue : undefined}
            data-year={nav.kind === "year" ? nav.anchorValue : undefined}
            className="text-[17px] font-semibold text-ink"
          >
            {nav.label}
          </p>
          <Link
            data-testid={`${nav.kind}-next`}
            to={withTeamParam(nav.nextTo, search)}
            aria-label="Next"
            className={ICON_BUTTON}
          >
            &rsaquo;
          </Link>

          {/* AC-13. The anchorless address of the view being looked at, so `Today` on `/month/2019-03`
              lands on `/month` and the month screen resolves the current month. */}
          <Link
            data-testid="shell-period-today"
            to={withTeamParam(nav.todayTo, search)}
            className={PILL_OUTLINE}
          >
            Today
          </Link>
        </>
      ) : null}

      <div className="ml-auto flex items-center gap-3">
        {/* AC-14. Three segments, and each target KEEPS THE DATE — `month-year` from
            `/month/2027-04` reaches `/year/2027` and not the current year. The targets are the ones
            the screens' own cross-view links already compute (§ 4.5).

            **AMENDED BY SOLO 2026-09-11, AND THE EXCEPTION IS `weekTo` FROM A MONTH OR A YEAR.**
            Those two now reach `/week`, which the week screen resolves to TODAY. The operator was
            shown AC-14's contract and chose against it for this one segment: *"khi mở lịch tuần
            default luôn là today"*. `src/lib/period.ts` carries the reasoning at both sites.

            **THE SENTENCE ABOVE IS STILL TRUE OF EVERY OTHER TARGET** — `month-year`, `week-month`,
            `week-year`, `year-month` all keep the date, and the `month-week` case was the one where
            "the date" had to be invented anyway: a month has no week and a year has no week, so the
            old values picked the 1st. */}
        {/* Always drawn. On a period screen the name is `<nav.kind>-<kind>` as before; elsewhere
            it is `shell-<kind>` and no segment is active. */}
        <div className="flex items-center gap-0.5 rounded-pill bg-track p-0.5">
          {segments.map((segment) => {
            const on = segment.kind === nav?.kind;
            return (
              <Link
                key={segment.kind}
                data-testid={`${nav?.kind ?? "shell"}-${segment.kind}`}
                to={withTeamParam(segment.to, search)}
                aria-current={on ? "page" : undefined}
                className={segmentClass(on)}
              >
                {segment.label}
              </Link>
            );
          })}
        </div>

        {/* Tasks, for every role on every shell screen, filled while on `/tasks*`. */}
        <Link
          data-testid="shell-tasks-link"
          to="/tasks"
          aria-current={onTasks ? "page" : undefined}
          className={navPillClass(onTasks)}
        >
          <ListTodo aria-hidden="true" className="h-3.5 w-3.5" />
          Tasks
        </Link>

        {/* AC-19. The twelfth relocated id, and the one that does NOT go to the sidebar. It is the
            screen's primary action and the transcription puts it in this cluster; the binding
            constraint from `ticket.yaml` § 5 is *unrenamed and exactly once*, which holds either
            way. It renders on EVERY route inside the shell, which is what keeps the fifteen spec
            files that click it immediately after signing in working.

            No `Duyệt phép` button beside it (AC-20): the approval worklist shipped with its own
            link, `home-pending-entries-link`, and that link is in the sidebar. A second control to
            one address would either duplicate an id — the strict-mode failure AC-6 exists to
            prevent — or give the product two names for one screen. */}
        {/* SOLO 2026-10-14's `shell-calendar-link`, on the events screens only, STOOD HERE. The
            Week/Month/Year group above is now drawn on every shell screen, and it is the way back. */}

        {/* UIE-09 AC-1, AC-2 and AC-11. An OUTLINE PILL WITH NO CARET, reusing `PILL_OUTLINE` so it
            is the same object as `Today` rather than a new one that looks like it — the shape the
            transcription draws, and not a disclosure control (§ 2b). It reaches a SCREEN at an
            address rather than opening a menu: § 8, rejected alternative 1.

            IT SITS OUTSIDE THE `nav !== null` CONDITION AND RENDERS ON EVERY ROUTE INSIDE THE SHELL,
            including the ones with no period — `/allow-list`, `/setting`, `/admin` itself. AC-11
            is the criterion that says adding an always-present control did not disturb the
            conditionally-present cluster above it.

            ABSENT FOR A MEMBER, NOT DISABLED (AC-2). A disabled control asserts that an area exists
            and is merely unavailable, which is the opposite of what the sidebar's own four
            admin-only links say by simply not being there.

            **SOLO, 2026-09-11 — ONE ELEMENT, ONE ID, TWO FACES.** On an admin address it
            reads `Calendar` and points at `/`; everywhere else inside the shell it is UIE-09's
            `Admin` pointing at `/admin`. It is the SAME CONTROL — the way between the calendar and
            the admin area — so it keeps `shell-admin-link` rather than splitting into two ids: the
            twelve `toHaveCount(0)` denials across the suite assert that a MEMBER is offered no way
            in, and a second id would have left half of them asserting about a name that renders for
            nobody, which is the exact defect UIE-10 AC-4 was written to undo.

            `data-state` IS THE FACE, AND IT EXISTS BECAUSE THE ID NO LONGER NAMES THE DESTINATION.
            `calendar` or `admin`, read rather than inferred from the label, so a spec standing on an
            admin screen can say which one it expects instead of finding out by where the click
            lands. AC-12's no-diacritic rule covers both words: they are English.

            **THE FIVE ADMIN SCREENS NOW HAVE ONE WAY OUT AND NOT TWO.** Reaching the hub from
            `/threshold` was this control; it is now the strip's absence of a hub tab plus this
            control's other face, so the hub is reached from a destination by going back to the
            calendar and in again. That is the cost the operator accepted when they chose all six
            addresses over `/admin` alone, and it is why UIE-09 AC-1 and AC-4 and UIE-10 AC-3 are
            rewritten rather than merely passing. */}
        {/* SOLO 2026-09-12, ADR-035. **DRAWN FOR A MANAGER TOO, AND POINTED SOMEWHERE ELSE.** The
            hub at `/admin` lists what an admin may do and refuses everybody else, so sending a
            manager there would be handing them a door that shuts in their face. Their whole admin
            area is one screen, so the control goes straight to it — `data-state` still says which
            face is showing, and `/` is still the way back for both. */}
        {/* **ONE FACE AGAIN.** With the period group drawn on every shell screen, the way back to the
            calendar is always there, so this control no longer flips to `Calendar` on an admin
            address. It always reads `Admin` with `data-state="admin"`, and is filled, with
            `aria-current`, while on one. `data-state` stays so the specs that read it keep a value. */}
        {mayDecide(role) ? (
          <Link
            data-testid="shell-admin-link"
            data-state="admin"
            to={mayAdminister(role) ? "/admin" : "/entries/pending"}
            aria-current={onAdmin ? "page" : undefined}
            className={navPillClass(onAdmin)}
          >
            Admin
          </Link>
        ) : null}

        {/* EVT-01 AC-19. **Events**, immediately before `+ Book`, on every shell screen for every
            role — outside the `nav !== null` condition, as `shell-admin-link` is. The same outline
            pill as `Today` and `Admin` (§ 2b), and `aria-current` on the events screens. */}
        <Link
          data-testid="nav-events-link"
          to="/events"
          aria-current={onEvents ? "page" : undefined}
          className={navPillClass(onEvents)}
        >
          Events
        </Link>

        {/* EVT-04 AC-13. Between `Events` and `+ Book`, outside every condition — every shell screen,
            every role. */}
        <NotificationBell />

        {/* CAL-12 AC-9. Absent while another team is viewed: an entry booked from here lands on the
            CALLER's team and would vanish from the screen that created it (INV-07). An affordance,
            not a control — `createEntry` cannot reach another team whatever screen calls it. */}
        {isReadOnly(viewed) ? null : (
          <Link
            data-testid="home-new-entry-link"
            to="/entries/new"
            className="rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            + Book
          </Link>
        )}
      </div>
    </header>
  );
}
