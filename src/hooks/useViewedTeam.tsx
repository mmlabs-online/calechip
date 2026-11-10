// CAL-12 — the viewed-team provider, resolved once per shell. 01-plan.md § 4.2.
//
// **THE SELECTION IS THE ADDRESS.** `?team=<id>` on a calendar screen, and nowhere else — the plan
// decides the idea's open question 1 this way (§ 8, rejected alternative 1), so a link to another
// team's month survives a reload and can be shared. This provider holds no copy of it: it reads the
// parameter, resolves it with `resolveViewedTeam`, writes back only to drop a parameter that names
// no team (AC-11), and builds the picker's link targets (`hrefFor`, AC-4).
//
// **ONE SEAM CALL, AND ONLY FOR AN ADMIN.** `seam.listTeams()` is CAL-11's definer read; it returns
// nothing to anybody else, and nobody else is offered a picker, so a `member` or a `manager` never
// makes it. Through the seam's one door (RULE-02).
//
// It sits ABOVE `Sidebar`, `TopBar` and the outlet (`AppShell.tsx`), so the three share one
// resolution — two resolutions would be free to disagree for a frame about which team is on screen.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { seam } from "@/lib/data";
import type { Member, Team } from "@/lib/domain/types";
import { mayAdminister } from "@/lib/roles";
import { TEAM_PARAM, isCalendarPath, pickableTeams, resolveViewedTeam, type ViewedTeam } from "@/lib/viewed-team";

export interface ViewedTeamValue {
  /** Always { kind: "own" } when !isCalendarPath(pathname). */
  viewed: ViewedTeam;
  /** pickableTeams(member.role, loaded teams); [] while loading, after a failure, off-calendar. */
  teams: readonly Team[];
  ownTeamId: string | null;
  /** The address that views `teamId`: current pathname + current search with TEAM_PARAM deleted
   *  when teamId === ownTeamId, else set to teamId; other search params kept; "?" only when the
   *  search is non-empty. Off the calendar screens: pathname unchanged. Followed by a <Link>, so a
   *  PUSH navigation (Back works), path unchanged (AC-4). */
  hrefFor(teamId: string): string;
}

const OWN: ViewedTeam = { kind: "own" };

// What a screen rendered with no provider reads — `BareLayout`, a signed-out visitor. The own team,
// and no picker, so `hrefFor` is never followed.
const DEFAULT_VALUE: ViewedTeamValue = { viewed: OWN, teams: [], ownTeamId: null, hrefFor: () => "" };

const ViewedTeamContext = createContext<ViewedTeamValue>(DEFAULT_VALUE);

/** The last `listTeams()` answer, and the parameter it was read for. */
interface LoadedTeams {
  teams: readonly Team[] | "failed";
  forRequest: string | null;
}

const namesNoOtherTeam = (requested: string | null, ownTeamId: string | null): boolean =>
  requested === null || requested === "" || requested === ownTeamId;

export function ViewedTeamProvider({ member, children }: { member: Member; children: ReactNode }) {
  const { pathname, search } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const onCalendar = isCalendarPath(pathname);
  const isAdmin = mayAdminister(member.role);
  const ownTeamId = member.teamId;

  // Off the calendar screens the parameter is not read at all (AC-10), so it can neither resolve nor
  // be dropped there.
  const requested = onCalendar ? searchParams.get(TEAM_PARAM) : null;

  const [loaded, setLoaded] = useState<LoadedTeams | null>(null);

  // Is the loaded list an answer for THIS parameter? A list read before the parameter changed may
  // simply not have had the team yet — a team created a minute ago — and treating it as final would
  // drop a valid parameter (rule 7) before the re-read below could find it. Until the re-read lands
  // the resolution is `resolving`.
  const current =
    loaded !== null &&
    (loaded.forRequest === requested ||
      namesNoOtherTeam(requested, ownTeamId) ||
      (loaded.teams !== "failed" && loaded.teams.some((t) => t.id === requested)));

  useEffect(() => {
    if (!isAdmin || current) return;
    let live = true;
    seam.listTeams().then(
      (teams) => {
        if (live) setLoaded({ teams, forRequest: requested });
      },
      () => {
        if (live) setLoaded({ teams: "failed", forRequest: requested });
      },
    );
    return () => {
      live = false;
    };
  }, [isAdmin, current, requested]);

  const resolution = resolveViewedTeam({
    role: member.role,
    ownTeamId,
    requested,
    teams: current && loaded !== null ? loaded.teams : null,
  });

  // AC-11. `replace`, so Back does not return to the address that named nothing.
  useEffect(() => {
    if (!resolution.dropParam) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(TEAM_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [resolution.dropParam, setSearchParams]);

  // Memoised on the identity key — the kind, and the team row, which is stable for as long as
  // `loaded` is — and not on the object `resolveViewedTeam` builds per render, so a screen can put
  // `viewed` in an effect's dependency list and re-read only when the team on screen actually
  // changes: the warning `AppShell.tsx` records about context objects in dependency lists.
  const kind = resolution.viewed.kind;
  const otherTeam = resolution.viewed.kind === "other" ? resolution.viewed.team : null;
  const stableViewed = useMemo<ViewedTeam>(() => {
    if (otherTeam !== null) return { kind: "other", team: otherTeam };
    if (kind === "resolving") return { kind: "resolving" };
    if (kind === "unavailable") return { kind: "unavailable" };
    return OWN;
  }, [kind, otherTeam]);

  const teams = useMemo(
    () =>
      onCalendar && loaded !== null && loaded.teams !== "failed" ? pickableTeams(member.role, loaded.teams) : [],
    [onCalendar, loaded, member.role],
  );

  // Choosing a team is a change of ADDRESS, so the picker is links and this builds their targets —
  // 01-plan.md § 4.4, amended: a `<select>` there would break UIE-10 AC-10's "no form control in
  // the sidebar", and a link is also what makes another team's view shareable.
  const hrefFor = useCallback(
    (teamId: string): string => {
      if (!onCalendar) return pathname;
      const next = new URLSearchParams(search);
      if (teamId === ownTeamId) next.delete(TEAM_PARAM);
      else next.set(TEAM_PARAM, teamId);
      const query = next.toString();
      return query === "" ? pathname : `${pathname}?${query}`;
    },
    [onCalendar, pathname, search, ownTeamId],
  );

  const value = useMemo<ViewedTeamValue>(
    () => ({ viewed: stableViewed, teams, ownTeamId, hrefFor }),
    [stableViewed, teams, ownTeamId, hrefFor],
  );

  return <ViewedTeamContext.Provider value={value}>{children}</ViewedTeamContext.Provider>;
}

export function useViewedTeam(): ViewedTeamValue {
  return useContext(ViewedTeamContext);
}
