// The routed shell. 02-design.md section 1.3 and section 6.2; TEA-05 01-plan.md section 4.4.
//
// `data-testid="app-root"` KEEPS its name and its position on the element wrapping <Routes>, so the
// scaffold smoke test in tests/e2e/smoke.spec.ts keeps passing without being edited — which is why
// that file is deliberately absent from allowed_paths. `seam-banner` keeps its name and position for
// the same reason.
import type { JSX } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useSearchParams } from "react-router-dom";
import { seamName } from "./lib/data";
import { useSession } from "./hooks/useSession";
import AppShell from "./components/AppShell";
import AdminLayout from "./components/AdminLayout";
import AdminHub from "./routes/AdminHub";
import AwaitingApproval from "./routes/AwaitingApproval";
import NewSignups from "./routes/NewSignups";
import Holidays from "./routes/Holidays";
import MemberList from "./routes/MemberList";
import MonthView from "./routes/MonthView";
import WeekView from "./routes/WeekView";
// CAL-10. The overview is the default year screen; `YearMembers` is the wrapper that keeps a
// malformed `/year/<bad>/members` on the member grid (AC-3), and `YearView` itself is unchanged.
import YearOverview, { YearMembers } from "./routes/YearOverview";
import EditEntry from "./routes/EditEntry";
import NewEntry from "./routes/NewEntry";
import PendingEntries from "./routes/PendingEntries";
// SOLO 2026-09-10. The caller's own profile, reached from the account footer in the sidebar.
import Profile from "./routes/Profile";
import TeamEntries from "./routes/TeamEntries";
import Threshold from "./routes/Threshold";
// SOLO, 2026-09-11 — many teams. The sixth admin tab.
import Teams from "./routes/Teams";
// SOLO, 2026-09-26 — the eighth admin tab: the reports people send from the bubble in `AppShell`.
import IssueReports from "./routes/IssueReports";
// EVT-01 — events: the list, one event, and the one form that creates and edits.
import Events from "./routes/Events";
import EventDetail from "./routes/EventDetail";
import EventEditor from "./routes/EventEditor";
// TSK-01 — a member's own tasks for a day.
import Tasks from "./routes/Tasks";
// EVT-06. The guest page — 01-plan.md § 4.4.
import GuestEvent from "./routes/GuestEvent";
// EVT-07. The manage page — 01-plan.md § 4.4. A named export of the guest page's file.
import { GuestRegistration } from "./routes/GuestEvent";
import NotOnATeam from "./routes/NotOnATeam";
import SignIn from "./routes/SignIn";
import SignUp from "./routes/SignUp";
// SOLO, 2026-09-11 — the loading mark that replaced this screen's "Loading…" sentence. The
// sentence itself is still announced: `Loader.tsx` keeps it as `sr-only` text, because the element
// below carries `role="status"` and an emptied one announces nothing.
import Loader from "@/components/Loader";
// EVT-14. The return-to `/signin` honours, and the rule that keeps it on this origin (AC-9).
import { RETURN_TO_PARAM, safeReturnTo } from "@/lib/return-to";

/**
 * UIE-02 § 4.6 and § 4.7 — the non-member arm of the shell layout route, and the home of the `p-8`
 * that `app-root` gave up.
 *
 * It is the centred, padded container that shipped before this ticket, unchanged in effect: a
 * signed-out or member-less caller sees exactly the screen they see today, in exactly the same
 * gutter, with no chrome (AC-2). `AuthCard.tsx:54` names that gutter as what satisfies UIE-01's
 * AC-16, so it had to land somewhere and this is where.
 *
 * USED IN TWO PLACES, AND THE SECOND ONE IS REVIEW REWORK 1. `/signin` and `/signup` stay outside
 * the SHELL layout route (§ 4.6, `ticket.yaml` § 3) — but "outside the shell" is not "outside every
 * container", and the first cycle read it as though it were: the two auth routes sat directly under
 * <Routes>, so the `p-8` that moved here never reached them and `AuthCard`'s own root carries no
 * padding (`AuthCard.tsx:60`). Measured at 360px the card had 2.5px either side and at 320px none,
 * where `app-root`'s `p-8` gave 32px before this ticket — UIE-01 AC-16 requires a gutter on both
 * sides, and the comment on `app-root` below says out loud that breaking it is what must not happen.
 *
 * The fix is a second `<Route element={<BareLayout />}>` parent over just those two routes. They are
 * still not children of the shell layout route, they still get no sidebar and no top bar, and no
 * membership condition is evaluated for them — the only thing they gain is the gutter § 4.7 says
 * they must have.
 */
function BareLayout() {
  return (
    <div className="p-8">
      <Outlet />
    </div>
  );
}

/**
 * EVT-14 § 4.2 — the `/signin` route's signed-in arm. Sends the caller to `?next=` when it is a path
 * on this origin (AC-8, AC-9) and to `/` otherwise, exactly as before this ticket (AC-10). A component
 * of its own because it must sit inside <BrowserRouter> to read the query string, and `App` does not.
 * `replace` is what keeps Back from showing the sign-in screen again (AC-8).
 */
function AfterSignIn(): JSX.Element {
  const [params] = useSearchParams();
  return <Navigate to={safeReturnTo(params.get(RETURN_TO_PARAM))} replace />;
}

export default function App() {
  // TEA-05 01-plan.md section 4.3: `useSession()` is called EXACTLY ONCE, here, and the result is
  // passed to the screens that need it as props. Section 9 records why this is a hook and not the
  // context provider TEA-02's design predicted — there is one consumer, and a provider would add a
  // file, a wrapper and an indirection to serve a single call site. The first component that needs
  // the session without a prop path should add the provider, backed by this same hook.
  const { membership, resolving, signIn, signOut, refresh } = useSession();

  return (
    <BrowserRouter>
      {/* UIE-02 § 4.7 — THE `TODO(project)` IN THE FEATURE ROW, ANSWERED RATHER THAN DISCOVERED.
          `app-root` KEEPS its name and its position on the element wrapping <Routes>, and
          `seam-banner` KEEPS its name and its position as that element's FIRST child — one spec
          file depends on the first and two on the second, and none is in scope here (AC-17).

          What changes is one class list. It gives up `p-8` and becomes a full-height flex COLUMN,
          so the banner is a full-width strip across the top of the viewport, above BOTH panes on
          every route including those inside the shell, and the shell takes the remaining height.
          It is a warning that the whole application is running on a fake datastore: inside the
          content pane it would be a property of the screen rather than of the build, and it would
          scroll away.

          THE `p-8` IT GAVE UP MOVES TO `BareLayout`, and that is not tidying. AuthCard.tsx:54
          names this element's `p-8` as the gutter that satisfies UIE-01's AC-16, so a shell that
          quietly removed it would break a criterion shipped one ticket ago. The `resolving`
          spinner below sits outside <Routes> and carries its own margin for the same reason. */}
      <main data-testid="app-root" className="flex min-h-screen flex-col bg-bg font-sans">
        {/* Design section 6.2 rule 2. A build with no VITE_SUPABASE_URL resolves to the in-memory
            seam rather than to a screen that throws — but a SILENT fallback to a fake datastore is
            worse than the crash it replaces: a deployment that forgets one environment variable
            would accept sign-ups into memory and look entirely normal. This banner is permanent and
            not dismissible, and it is also how a test asserts which implementation it drove. */}
        {seamName === "mock" ? (
          <p
            data-testid="seam-banner"
            data-seam="mock"
            role="status"
            className="mx-auto mb-6 max-w-md rounded-xl bg-amber-100 px-4 py-2 text-center text-sm text-amber-900"
          >
            Demo build — data lives only in this browser and is lost when you reload the page.
          </p>
        ) : null}

        {/* AC-9, and the reason it is a state rather than a fallthrough: `signed-out` and `not yet
            known` are indistinguishable without it, so routing on the membership alone would flash
            the sign-in screen at somebody who IS signed in, on every reload. Shown on every path. */}
        {resolving ? (
          <p
            data-testid="app-session-loading"
            role="status"
            className="mx-auto my-8 max-w-md rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
          >
            <Loader label="Loading…" />
          </p>
        ) : (
          <Routes>
            {/* THE TWO AUTH ROUTES, OUTSIDE THE SHELL LAYOUT ROUTE AND INSIDE A `BareLayout` OF
                THEIR OWN — UIE-02 § 4.6 and § 4.7 together, and REVIEW REWORK 1 is the second half.

                § 4.6 requires these two to stay outside the layout route below, and they do: they
                are not its children, no membership condition is evaluated for them, and neither
                gets a sidebar or a top bar. § 4.7 requires the `p-8` that `app-root` gave up to
                land where the auth screens' gutter is, and until this parent existed it did not —
                `BareLayout` was reachable only as the shell layout's non-member arm, which /signin
                and /signup never render inside. UIE-01 AC-16 is the criterion that turns on it, and
                it is one ticket old. See the comment on `BareLayout` for the measurement. */}
            <Route element={<BareLayout />}>
              {/* TEA-01. Reachable in EVERY membership state: it is the only route a person who has
                  not signed up can use, and it ends on its own notice (AC-13) rather than routing. */}
              <Route path="/signup" element={<SignUp />} />

              {/* EVT-06, AC-9. Reachable in EVERY membership state and signed out, with no guard: the
                  token is the whole address. EVT-13, AC-1 to AC-5 (ADR-061 decision 8): an approved
                  member is asked about, and a reader of the event is sent on to `/events/<id>` by
                  the page itself; everyone else sees exactly what a guest sees. EVT-14, AC-1, AC-2:
                  a signed-out caller is also offered sign-in and sign-up, which no session is. */}
              <Route
                path="/guest/:token"
                element={
                  <GuestEvent
                    signedInMember={membership.state === "member"}
                    signedOut={membership.state === "signed-out"}
                  />
                }
              />

              {/* EVT-07, AC-11, AC-13. The manage page: the same bare card, no guard, any state —
                  the manage token is the whole address. */}
              <Route path="/guest/registration/:token" element={<GuestRegistration />} />

              {/* AC-1, AC-2, AC-3, AC-5, AC-9. A caller with a session is sent to the landing
                  address instead — a sign-in screen offered to somebody already signed in is a
                  second way to reach a state they are already in. EVT-14, AC-8..AC-10: to `?next=`
                  when it is a path on this origin, and to `/` otherwise. */}
              <Route
                path="/signin"
                element={
                  membership.state === "signed-out" ? (
                    <SignIn signIn={signIn} />
                  ) : (
                    <AfterSignIn />
                  )
                }
              />
            </Route>

            {/* UIE-02 AC-1, AC-2, AC-3, AC-4 — THE SHELL, AS A LAYOUT ROUTE WITH ONE CONDITIONAL
                ELEMENT AND AN <Outlet />. Every route below is a child of it, and none of their
                own elements or guards changed.

                NOT A WRAPPER AROUND <Routes>. 01-plan.md § 8, rejected alternative 1: a wrapper
                paints the sidebar on /signin and /signup too, and the only escape is a
                useLocation() conditional inside the shell — this route table re-expressed as an
                if-statement, in a file that already uses the router for exactly this distinction
                six times over. The condition would then have to be extended by hand every time a
                route is added, and the failure is SILENT: a new auth-adjacent route simply appears
                with a sidebar. The layout route puts the decision where the router enforces it.

                THE NON-MEMBER ARM IS A BARE LAYOUT AND NOT A REDIRECT, AND THAT IS THE TRAP THIS
                TICKET EXISTS AROUND (AC-3). Six of the routes below are deliberately unguarded and
                each renders its OWN refusal — `allow-list-refused`, `member-list-not-on-a-team`,
                `month-not-on-a-team`, `week-not-on-a-team`, `year-not-on-a-team`, and for
                /holidays the calendar itself. A shell that rendered only for a member and
                redirected otherwise would convert six documented refusals into redirects and
                delete the reason each one records. `BareLayout` is the container those screens
                render in today, so a member-less caller reaches exactly the screen they reach now.

                THE FIVE MEMBERSHIP GUARDS BELOW ARE UNTOUCHED (AC-4). They are on the children,
                where they were, and the layout adds none of its own. */}
            <Route
              element={
                membership.state === "member" ? (
                  // SOLO 2026-09-10. `refresh` reaches the profile screen through the shell's
                  // outlet context: `updateOwnProfile` writes the member row without touching the
                  // session, so nothing else would tell this hook to read it again.
                  <AppShell
                    member={membership.member}
                    signOut={signOut}
                    refreshMembership={refresh}
                  />
                ) : (
                  <BareLayout />
                )
              }
            >
              {/* THE LANDING ADDRESS, AS THIS LAYOUT'S INDEX ROUTE. Amended at PLAN rework 1 —
                  it was outside the layout, and it redirected a member to `/week`.

                  UIE-02 AC-5 and AC-23. The three memberships still land in three different places
                  and TEA-05's AC-4, AC-5 and AC-9 are unchanged for the two with no member row.
                  What changed is the member's arm: `src/routes/Home.tsx` does not survive this
                  ticket (the feature row says so) and its twelve `home-*` ids are now in the shell,
                  so a member arriving at `/` sees THE CURRENT WEEK, IN PLACE. Week is the active
                  segment in the transcription.

                  IN PLACE, AND NOT A REDIRECT, AND THAT IS THE WHOLE OF PLAN REWORK 1. A redirect
                  makes `/` an address the application never rests on, and five shipped spec files
                  walk browser history back to it in helpers — a `page.goto` there would reset the
                  mock seam's module state and lose entries an earlier step created. Twenty-five
                  acceptance tests measured the difference.

                  AND NOT A REDIRECT WITHOUT `replace` EITHER, which is the other way to keep `/` in
                  history: arriving at `/` by popstate would fire the redirect again and forward the
                  caller onward for ever, which is the Back-button trap AC-23's second clause names.

                  `NotOnATeam` renders inside `BareLayout`, because this layout's ELEMENT is chosen
                  on membership above — so it is still outside the shell, exactly as `ticket.yaml`
                  § 3 requires. */}
              <Route
                index
                element={
                  membership.state === "member" ? (
                    <WeekView landing />
                  ) : membership.state === "undecided" ? (
                    // SOLO, 2026-09-10. **A FOURTH BRANCH, AND WITHOUT IT THIS ROUTE LOOPS.** An
                    // `undecided` caller fell through to `<Navigate to="/signin">`, and `/signin`
                    // sends anybody holding a session back to `/` — so a person who had just signed
                    // up bounced between the two forever. Reachable by everybody the moment the
                    // allow-list stopped being the gate, and by nobody before it.
                    <AwaitingApproval member={membership.member} signOut={signOut} />
                  ) : membership.state === "member-less" ? (
                    <NotOnATeam user={membership.user} signOut={signOut} />
                  ) : (
                    <Navigate to="/signin" replace />
                  )
                }
              />

              {/* TEA-02. Reachable by address only: 02-design.md section 2 satisfies AC-9 with the
                  absence of a link plus the screen's own refusal. TEA-05 adds the one link the feature
                  row permits, on the landing screen and only for an admin — not here.

                  NOT GUARDED, deliberately (TEA-05 01-plan.md section 9). This screen already fails
                  safe with no session: it calls getCurrentMember(), gets null, and renders
                  `allow-list-refused`. A guard here would add no protection and would put this
                  ticket's routing decisions on top of another ticket's acceptance criteria. */}
{/* **SOLO, 2026-09-09 — THE ADMIN TAB STRIP, AND WHY THERE ARE SEVERAL OF THESE BLOCKS
                  RATHER THAN ONE.** `AdminLayout` draws `AdminTabs` above whatever the child route
                  renders, so the ROUTER decides which screens carry the strip — the same shape
                  `BareLayout` and `AppShell` above already use, and not a `useLocation()` test
                  inside a component (`AdminLayout.tsx` records why at length).

                  The admin addresses fall into ADJACENT RUNS in this table, and they are wrapped
                  where they lie instead of being gathered into one block. Gathering them would move
                  every one of those route blocks and roughly a hundred and thirty lines of the
                  reasoning attached to them, and it would reorder a table whose order carries a
                  documented argument — `/entries/pending` sits above `/entries/:id/edit` and the
                  comment there explains why. A two-line wrapper per run costs less than that and
                  changes no matching: no admin path is a prefix of another, and the `*` catch-all
                  stays last.

                  SOLO, 2026-09-12: a FOURTH block, around `/holidays` and `/holidays/:year`, when
                  the operator moved Public holidays into the panel. It is the only run whose routes
                  are not admin-guarded — see the block itself.

                  `isAdmin` AND NOT THE `Member`: the layout's one question is whether to draw the
                  strip, and a member must not be handed a list of the five administrative addresses
                  on every screen that refuses them — UIE-10 AC-1 removed exactly that from the
                  sidebar. Each destination keeps its own guard below, untouched. */}
              <Route element={<AdminLayout role={membership.state === "member" ? membership.member.role : null} />}>
                {/* SOLO, 2026-09-10. `/allow-list` is gone with the allow-list. `/signups` is the
                    admin queue that replaced it; the screen renders its own refusal, so this route
                    is unguarded for the same two reasons `/allow-list` recorded. */}
                <Route path="/signups" element={<NewSignups />} />
                {/* TEA-03. Reachable by address only, and not guarded, for the same two reasons: it
                    renders `member-list-not-on-a-team` when getCurrentMember() returns null. */}
                <Route path="/members" element={<MemberList />} />
              </Route>

              {/* CAL-01. GUARDED, unlike the two above, and the difference is not a change of mind:
                  an entry needs a member row to belong to (INV-07, `member_id` not-null against
                  `member(id)`), so a caller with no member row has nothing this screen could create.
                  /allow-list and /members each render a refusal of their own for that case; this one
                  would render a form whose every submission is refused by the policy.

                  A caller who is signed out or member-less lands on `/`, which then resolves by
                  membership — the sign-in screen or the member-less screen. The guard is an affordance
                  either way: `entry_insert_own` is the control and it refuses the write whoever
                  reaches it. */}
              <Route
                path="/entries/new"
                element={membership.state === "member" ? <NewEntry /> : <Navigate to="/" replace />}
              />

              {/* CAL-02. Guarded exactly as /entries/new is, and for the same reason: an entry belongs
                  to a member row (INV-07), so a caller with no member row has nothing this screen
                  could edit. The guard is an affordance either way — `entry_update_own` is the control
                  and it refuses the write whoever reaches it, and the screen itself answers
                  `edit-entry-not-found` for an entry that is not the caller's.

                  No route for a DELETE. There is no screen to delete from: the control lives on the
                  own-entry list beside the row it removes, where the row's dates are on screen at the
                  moment the confirmation is pressed. */}
              <Route
                path="/entries/:id/edit"
                element={membership.state === "member" ? <EditEntry /> : <Navigate to="/" replace />}
              />

              {/* CAL-03. Guarded exactly as /entries/new and /entries/:id/edit are, and for the same
                  reason: this screen lists and writes ENTRIES, and an entry belongs to a member row
                  (INV-07), so a caller with no member row has nothing here to reach.

                  THE GUARD IS `member` AND NOT `admin`, deliberately. A member who types this address
                  must reach the component and be refused BY IT (`team-entries-refused`, AC-10) rather
                  than be bounced to `/` — the refusal is what says why, and a redirect would leave
                  somebody who mistyped nothing to read. The guard is an affordance either way:
                  `entry_update_admin` and `entry_delete_admin` are the controls and they refuse the
                  write whoever reaches them. */}
{/* SOLO, 2026-09-09 — the admin tab strip, block 2 of 3. See block 1 above for why three. */}
              <Route element={<AdminLayout role={membership.state === "member" ? membership.member.role : null} />}>
                <Route
                  path="/entries/team"
                  element={membership.state === "member" ? <TeamEntries /> : <Navigate to="/" replace />}
                />

                {/* ADM-04. The worklist of entries awaiting a decision, at its own address — ADM-01's
                    `TODO(project):` was answered at its own PLAN with *its own screen at /threshold*,
                    and .ai/registry/features.md:103 says the later admin rows inherit that answer rather
                    than re-asking it. `/entries/pending` sits in the family `/entries/team` and
                    `/entries/new` already established.

                    A STATIC SEGMENT ABOVE `/entries/:id/edit`, and it cannot be shadowed by it: react
                    router v7 ranks a static segment above a dynamic one regardless of declaration order,
                    so `/entries/pending` never resolves to EditEntry with an id of "pending".

                    GUARDED ON `member` AND NOT ON `admin`, which is the choice /entries/team and
                    /threshold already record: a member who types this address must reach the component
                    and be refused BY IT (`pending-entries-refused`, AC-10) rather than be bounced to
                    `/`, because the refusal is what says why. The guard is an affordance either way —
                    and here there is no control behind it at all: `entry_select_team` admits these rows
                    to both roles, so a member who got past the refusal would see what they can already
                    read at /entries/team (01-plan.md section 3). */}
                <Route
                  path="/entries/pending"
                  element={membership.state === "member" ? <PendingEntries /> : <Navigate to="/" replace />}
                />
              </Route>

              {/* CAL-04. The month grid, and the anchor is the URL — `/month/2026-04` typed directly
                  produces the same screen as pressing "next" from March (AC-10). `/month` with no
                  anchor redirects to the current month, and so does a malformed one; the component
                  does that itself rather than a second route doing it here, because "which month is
                  it" is a fact about the caller's clock and this file holds no clock.

                  NOT GUARDED, unlike /entries/new and /entries/team, and the difference is the same
                  one /allow-list and /members already record: this screen READS, it renders
                  `month-not-on-a-team` for a caller with no member row, and that refusal is what says
                  why. A redirect would leave somebody who followed a shared month link with nothing to
                  read. The guard would be an affordance either way — `entry_select_team`,
                  `member_select_team` and `team_select_own` are the controls. */}
              <Route path="/month" element={<MonthView />} />
              <Route path="/month/:month" element={<MonthView />} />

              {/* CAL-05. The week view, and the anchor is the URL exactly as the month's is —
                  `/week/2026-10-07` typed directly produces the same screen as pressing "next" from
                  the week before (AC-1, AC-14). ANY day of a week produces the same seven sections,
                  which is what makes a link from any date work; the component resolves the Monday
                  itself. `/week` with no anchor redirects to the current week, and so does a malformed
                  one, and the component does that rather than a second route here — "what day is it"
                  is a fact about the caller's clock and this file holds no clock.

                  NOT GUARDED, for the reason /month already records: this screen READS, it renders
                  `week-not-on-a-team` for a caller with no member row, and that refusal is what says
                  why. A redirect would leave somebody who followed a shared week link with nothing to
                  read. `entry_select_team` and `member_select_team` are the controls, and this ticket
                  adds no policy — every read it makes was already permitted. */}
              <Route path="/week" element={<WeekView />} />
              <Route path="/week/:day" element={<WeekView />} />

              {/* CAL-06. The year view, and the anchor is the URL exactly as the month's and the
                  week's are — `/year/2026` typed directly produces the same screen as pressing "next"
                  from 2025 (AC-1, AC-11). `/year` with no anchor redirects to the current year, and so
                  does a malformed one, and the component does that rather than a second route here —
                  "which year is it" is a fact about the caller's clock and this file holds no clock.

                  NOT GUARDED, for the reason /month and /week already record: this screen READS, it
                  renders `year-not-on-a-team` for a caller with no member row, and that refusal is
                  what says why. A redirect would leave somebody who followed a shared year link with
                  nothing to read. `entry_select_team` and `member_select_team` are the controls, and
                  this ticket adds no policy — every read it makes was already permitted.

                  CAL-10 § 4.2, inside ADR-032. THREE LINES WHERE THERE WERE TWO, and the change is
                  which path each screen is mounted at rather than anything either screen does. The
                  OVERVIEW is now the default year — `/year` and `/year/:yyyy` — and CAL-06's
                  per-member 365-column grid moves, behaviourally unchanged, to `/year/:yyyy/members`
                  (AC-1, AC-2). Both are kept: ADR-032 option 3, chosen by the operator on
                  2026-09-09 over replacing the grid outright.

                  THERE IS DELIBERATELY NO `/year/members` ROUTE. The grid is always anchored by a
                  year, and the anchorless case is `/year`, which is the overview.

                  `YearMembers` IS A WRAPPER OVER `YearView` AND NOT A SECOND SCREEN — it is the
                  malformed-anchor case of AC-3 and nothing else, and the file it lives in says why
                  it is not written here. The grid itself is untouched by this ticket. */}
              <Route path="/year" element={<YearOverview />} />
              <Route path="/year/:year" element={<YearOverview />} />
              <Route path="/year/:year/members" element={<YearMembers />} />

              {/* ADM-01. The threshold setting, at its own address (01-plan.md Open question 1: the
                  registry row leaves the surface open and recommends its own screen, so ADM-02,
                  ADM-03 and ADM-04 inherit this answer rather than inventing an admin area here).

                  GUARDED ON `member` AND NOT ON `admin`, which is the choice /entries/team already
                  records: a member who types this address must reach the component and be refused BY
                  IT (`threshold-refused`, AC-4) rather than be bounced to `/`, because the refusal is
                  what says why. A caller with no session or no member row lands on `/`, which then
                  resolves by membership. The guard is an affordance either way — `team_update_admin`
                  and `grant update (overload_threshold)` are the controls and they refuse the write
                  whoever reaches them. */}
{/* SOLO, 2026-09-09 — the admin tab strip, block 3 of 3. See block 1 above for why three. */}
              <Route element={<AdminLayout role={membership.state === "member" ? membership.member.role : null} />}>
                {/* SOLO, 2026-09-11 — RE-ADDRESSED FROM `/threshold` TO `/setting` ON THE OPERATOR'S
                    INSTRUCTION, when the screen gained the approval switches beside the name and the
                    threshold. The guard is unchanged and so is the component. UIE-09's comment below
                    that "`/threshold` is still `/threshold`" was true when written and is superseded
                    by this decision, not contradicted by an oversight.

                    `/threshold` REDIRECTS RATHER THAN DISAPPEARING. A bookmark or a link pasted into a
                    chat last week should still land on the screen it meant, and the catch-all at the
                    bottom would otherwise send it to `/` with no word about why. */}
                <Route
                  path="/setting"
                  element={membership.state === "member" ? <Threshold /> : <Navigate to="/" replace />}
                />
                <Route path="/threshold" element={<Navigate to="/setting" replace />} />

                {/* SOLO, 2026-09-11 — many teams. The sixth admin address, inside this layout block so
                    the tab strip draws above it. The guard is its neighbours' shape and is an
                    affordance: `Teams.tsx` refuses a member in place, and every write is refused by
                    its own `security definer` function whoever reaches it. */}
                <Route
                  path="/teams"
                  element={membership.state === "member" ? <Teams /> : <Navigate to="/" replace />}
                />

                {/* SOLO, 2026-09-26 — the eighth admin address, inside this layout block so the tab
                    strip draws above it. The guard is `/teams`' shape and is an AFFORDANCE, not the
                    control: `IssueReports.tsx` refuses a non-admin in place, and the read itself is
                    refused by `issue_report_select_admin` — which answers an EMPTY LIST rather than
                    an error, so somebody who reaches the screen another way sees nothing rather than
                    somebody else's report.

                    GUARDED ON `member` AND NOT ON `admin`, which is the choice every screen in this
                    block already makes: the membership guard keeps a signed-out caller off the
                    address, and the RANK question belongs to the screen, which has a sentence for
                    it. A guard on `admin` here would convert a documented refusal into a redirect. */}
                <Route
                  path="/reports"
                  element={
                    membership.state === "member" ? <IssueReports /> : <Navigate to="/" replace />
                  }
                />

                {/* UIE-09. The admin hub — one screen naming every administrative destination, and
                    the only thing in the product that links to `/members`, which has been a route with
                    no link anywhere in `src/` since TEA-03 (01-plan.md § 1).

                    IT ADDS A ROUTE ABOVE THE FOUR AND MOVES NONE OF THEM. `/threshold` is still
                    `/threshold`, `/allow-list` is still `/allow-list`, and each keeps its own back
                    link. THERE ARE DELIBERATELY NO CHILDREN: a tabbed `/admin/threshold` family would
                    re-address four shipped screens and reverse ADM-01's Open question 1 along with the
                    answer ADM-02, ADM-03 and ADM-04 all inherited — `ticket.yaml` § 7 fences it and
                    01-plan.md § 8 rejects it on the merits.

                    GUARDED ON `member` AND NOT ON `admin`, which is the choice /entries/team,
                    /entries/pending and /threshold each already record: a member who types this address
                    must reach the component and be refused BY IT (`admin-hub-refused`, AC-6) rather
                    than be bounced to `/`, because the refusal is what says why. A caller with no
                    session or no member row lands on `/`, which then resolves by membership (AC-7).
                    The guard is an affordance either way, and here it guards nothing at all: the screen
                    renders five LINKS and no control, and each of the five destinations keeps the guard
                    and the policy it already had. */}
                <Route
                  path="/admin"
                  element={membership.state === "member" ? <AdminHub /> : <Navigate to="/" replace />}
                />
              </Route>

              {/* ADM-02. The national holiday calendar, and the anchor is the URL exactly as the
                  month's, the week's and the year's are — `/holidays/2026` typed directly produces the
                  same screen as pressing *next* from 2025 (AC-8). `/holidays` with no anchor resolves
                  to the current year, and so does a malformed one, and the component does that rather
                  than a second route here — "which year is it" is a fact about the caller's clock and
                  this file holds no clock (AC-9).

                  GUARDED ON A SESSION AND NOT ON A ROLE, which is unlike every guard above it. Both
                  signed-in states render: a holiday belongs to no team, so there is no "you are not
                  on a team" to say about a national calendar, and no role to check either, because
                  `Read the holiday calendar` is checked for both roles in
                  .ai/standards/rbac-and-security.md (AC-1, AC-2). MIR-15-e, ADR-079 decision 3 — a
                  caller with no member row, pending, or removed no longer reads the calendar exactly
                  as a member does: `holiday_select_all` was replaced by `holiday_select_own_org`, so
                  that caller reads no row since there is no org for the read to scope to, and the
                  screen says so (MIR-15-e AC-5) rather than rendering an empty year.

                  A SIGNED-OUT CALLER GOES TO `/`, which resolves by membership to the sign-in screen.
                  That guard exists for one specific reason rather than for symmetry: with no session
                  the read returns nothing, and an unguarded screen would then render AC-10's
                  past-the-horizon notice and tell a stranger the calendar is short (AC-6). It is an
                  affordance either way — `grant select … to authenticated` is the control. */}
              {/* SOLO, 2026-09-12 — **UNDER `AdminLayout` SO THE TAB STRIP DRAWS, AND THE GUARD
                  IS UNCHANGED.** The operator moved `Public holidays` into the admin panel. The two
                  are separate questions and only the first moved: `AdminLayout` decides whether the
                  STRIP renders and takes `isAdmin` for it, while the `element` below still admits
                  any signed-in caller — so a member who types this address reads the calendar
                  exactly as before and simply sees no strip above it. Making this route admin-only
                  would contradict `Read the holiday calendar` in
                  .ai/standards/rbac-and-security.md, which is human plane under RULE-01. */}
              <Route element={<AdminLayout role={membership.state === "member" ? membership.member.role : null} />}>
                <Route
                  path="/holidays"
                  element={
                    membership.state === "signed-out" ? <Navigate to="/" replace /> : <Holidays />
                  }
                />
                <Route
                  path="/holidays/:year"
                  element={
                    membership.state === "signed-out" ? <Navigate to="/" replace /> : <Holidays />
                  }
                />
              </Route>
              {/* EVT-01, 01-plan.md § 4.4. Four addresses, guarded exactly as the calendar and entry
                  routes are — `membership.state === "member"` — inside the shell layout and NOT under
                  `AdminLayout`: every approved member of every role creates and reads events, and it
                  is not administration.

                  The guard is an affordance. `event_select_visible`, `event_insert_own` and the two
                  manage policies are the controls, and a pending, rejected or removed person is
                  refused by them whoever reaches these screens (AC-9). `/events/new` is declared
                  before `/events/:id` for the reader; the router ranks a static segment above a
                  parameter either way. */}
              <Route
                path="/events"
                element={membership.state === "member" ? <Events /> : <Navigate to="/" replace />}
              />
              <Route
                path="/events/new"
                element={membership.state === "member" ? <EventEditor /> : <Navigate to="/" replace />}
              />
              <Route
                path="/events/:id"
                element={membership.state === "member" ? <EventDetail /> : <Navigate to="/" replace />}
              />
              <Route
                path="/events/:id/edit"
                element={membership.state === "member" ? <EventEditor /> : <Navigate to="/" replace />}
              />

              {/* TSK-01, 01-plan.md § 4.6. Two addresses, guarded as the events routes are and inside
                  the shell, not under `AdminLayout`: every role keeps its own list.

                  The guard is an affordance. `task_select_own` and its three siblings are the
                  controls, and they have no admin, manager or team arm (ADR-057). */}
              <Route
                path="/tasks"
                element={membership.state === "member" ? <Tasks /> : <Navigate to="/" replace />}
              />
              <Route
                path="/tasks/:day"
                element={membership.state === "member" ? <Tasks /> : <Navigate to="/" replace />}
              />

              {/* **SOLO, 2026-09-10 — the personal profile screen.** No ticket and no plan;
                  `.claude/agents/solo.md` and ADR-033 are the authority, and `Profile.tsx` carries
                  the reasoning.

                  GUARDED ON A MEMBER ROW, like `/entries/new` and `/entries/:id/edit` above and
                  unlike `/allow-list`: the screen's whole subject is the caller's member row, so a
                  caller who has none has nothing here to read. A signed-out or member-less caller
                  lands on `/`, which resolves by membership to the sign-in screen or the
                  member-less one. It is an affordance either way — the seam's own reads are the
                  control and they return nothing without a session.

                  NOT UNDER `AdminLayout`. It is every member's own screen and it is not
                  administration; a tab strip above it would put five admin addresses on a page a
                  member reaches from their own name. */}
              <Route
                path="/profile"
                element={membership.state === "member" ? <Profile /> : <Navigate to="/" replace />}
              />

              {/* AC-9. Every address the application does not route lands on `/`, which then
                  resolves by membership — so a caller with no session reaches the sign-in screen and
                  a member reaches the current week. This replaced TEA-01's temporary `→ /signup`,
                  which existed only because that half of the feature had one screen and no landing
                  address to send anybody to. The eleven back-links pointing at `/` keep working.

                  INSIDE THE LAYOUT ROUTE since PLAN rework 1, where § 4.6 puts every route that is
                  not /signin or /signup. It was outside in the previous cycle to avoid painting a
                  shell in order to leave it one tick later; `/` is now a screen inside this same
                  layout, so the layout does not remount on the way there and there is nothing left
                  to avoid. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        )}
      </main>
    </BrowserRouter>
  );
}
