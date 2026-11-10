// CAL-12 — which team the calendar screens and the sidebar roster draw. 01-plan.md § 4.1.
//
// **PURE LOGIC AND ONE READ SWITCH, AND NOTHING ELSE.** No React, no router, no seam instance: the
// seam arrives as an argument, so `tests/viewed-team.test.ts` hands it the mock (or a stub that
// throws) and proves the switch without a browser. This file imports the `DataSeam` TYPE only —
// RULE-02 is about who reaches the datastore, and a type reaches nothing.
//
// **`teamReadsFor` IS THE ONLY PLACE THE OWN/OTHER BRANCH IS WRITTEN.** 01-plan.md § 8, rejected
// alternative 2: five copies of the switch, one in each screen and the roster, and a single missed
// branch draws team A's rows under team B's notice — an INV-07 violation that looks correct. Here it
// is written once, and an `other` read never calls an own-team method, so a failure cannot fall back
// to the caller's own team (AC-12).
//
// **NO COUNT IS COMPUTED HERE (INV-04).** `roster()` returns the FULL roster, removed members
// included, because `absenceCountsFor` needs them; the sidebar's removed-member filter is display
// only and lives in `useRoster`.
import type { DataSeam } from "@/lib/data";
import type {
  BusyDay,
  CalEvent,
  DateRange,
  Entry,
  Member,
  MemberRole,
  Team,
} from "@/lib/domain/types";

/** The one query-parameter name. */
export const TEAM_PARAM = "team";

/** Which team the calendar screens and the sidebar roster draw. */
export type ViewedTeam =
  | { kind: "own" } // the caller's team, through the existing own-team reads
  | { kind: "resolving" } // an admin's parameter is present, list_teams in flight
  | { kind: "unavailable" } // an admin's parameter is present, list_teams failed
  | { kind: "other"; team: Team }; // another team, read-only, its row from listTeams()

export interface ViewedTeamResolution {
  viewed: ViewedTeam;
  /** True only when an ADMIN's parameter names no listed team, or names the own team (AC-11). */
  dropParam: boolean;
}

/**
 * Rules, in order:
 *  1. role !== "admin"                       -> own, dropParam false   (AC-3: ignored, not stripped)
 *  2. requested null or ""                   -> own, dropParam false   (AC-1)
 *  3. requested === ownTeamId                -> own, dropParam true    (AC-11)
 *  4. teams === null                         -> resolving, false
 *  5. teams === "failed"                     -> unavailable, false     (AC-12)
 *  6. teams has a row with id === requested  -> other(that row), false (AC-4)
 *  7. otherwise                              -> own, dropParam true    (AC-11)
 */
export function resolveViewedTeam(input: {
  role: MemberRole;
  ownTeamId: string | null;
  requested: string | null;
  teams: readonly Team[] | null | "failed";
}): ViewedTeamResolution {
  const { role, ownTeamId, requested, teams } = input;
  if (role !== "admin") return { viewed: { kind: "own" }, dropParam: false };
  if (requested === null || requested === "") return { viewed: { kind: "own" }, dropParam: false };
  if (requested === ownTeamId) return { viewed: { kind: "own" }, dropParam: true };
  if (teams === null) return { viewed: { kind: "resolving" }, dropParam: false };
  if (teams === "failed") return { viewed: { kind: "unavailable" }, dropParam: false };
  const team = teams.find((t) => t.id === requested);
  if (team) return { viewed: { kind: "other", team }, dropParam: false };
  return { viewed: { kind: "own" }, dropParam: true };
}

// `/` is the week screen (WeekView `landing`); `/year/<x>/members` is the year overview's member
// grid. Every other shell address — the admin panel, events, teams, profile — is not a calendar
// screen and never reads the selection (AC-10).
const CALENDAR_PATH = /^\/(?:(?:week|month)(?:\/[^/]+)?|year(?:\/[^/]+(?:\/members)?)?)?\/?$/;

/** True for "/", "/week", "/week/<x>", "/month", "/month/<x>", "/year", "/year/<x>",
 *  "/year/<x>/members" — and for nothing else (AC-2, AC-7, AC-10). Trailing slash tolerated. */
export function isCalendarPath(pathname: string): boolean {
  return CALENDAR_PATH.test(pathname);
}

/** The picker's options: [] unless role === "admin" AND teams.length > 1 (AC-2, AC-3); otherwise
 *  every team sorted by name with localeCompare, then id. */
export function pickableTeams(role: MemberRole, teams: readonly Team[]): Team[] {
  if (role !== "admin" || teams.length <= 1) return [];
  return [...teams].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** True whenever the write affordances must be absent: viewed.kind !== "own" (AC-9). */
export function isReadOnly(viewed: ViewedTeam): boolean {
  return viewed.kind !== "own";
}

/** `to` with the `team` value of `search` carried across (AC-7). Returns `to` unchanged when `search`
 *  has no `team`; appends with "?" or "&" as `to` requires; value through encodeURIComponent. */
export function withTeamParam(to: string, search: string): string {
  const team = new URLSearchParams(search).get(TEAM_PARAM);
  if (team === null || team === "") return to;
  return `${to}${to.includes("?") ? "&" : "?"}${TEAM_PARAM}=${encodeURIComponent(team)}`;
}

/** The five reads every calendar screen and the roster make, for the viewed team. */
export interface TeamReads {
  team(): Promise<Team | null>;
  roster(): Promise<Member[]>; // removed members INCLUDED (INV-04)
  entriesOverlapping(range: DateRange): Promise<Entry[]>;
  busyDaysOverlapping(range: DateRange): Promise<BusyDay[]>;
  /** EVT-03. own -> seam.listEvents(); other -> seam.listEventsForTeam(team.id). */
  events(): Promise<CalEvent[]>;
}

/**
 * own   -> seam.getTeam(), seam.listMembers(), seam.listTeamEntriesOverlapping(range),
 *          seam.listTeamBusyDaysOverlapping(range), seam.listEvents()  — byte-for-byte today's calls.
 * other -> Promise.resolve(viewed.team), seam.listMembersForTeam(viewed.team.id),
 *          seam.listTeamEntriesOverlappingForTeam(viewed.team.id, range), Promise.resolve([]),
 *          seam.listEventsForTeam(viewed.team.id) (EVT-03).
 * An `other` TeamReads NEVER calls an own-team read, so a failure cannot fall back to team A (AC-12).
 */
export function teamReadsFor(
  seam: DataSeam,
  viewed: { kind: "own" } | { kind: "other"; team: Team },
): TeamReads {
  if (viewed.kind === "own") {
    return {
      team: () => seam.getTeam(),
      roster: () => seam.listMembers(),
      entriesOverlapping: (range) => seam.listTeamEntriesOverlapping(range),
      busyDaysOverlapping: (range) => seam.listTeamBusyDaysOverlapping(range),
      events: () => seam.listEvents(),
    };
  }
  const { team } = viewed;
  return {
    team: () => Promise.resolve(team),
    roster: () => seam.listMembersForTeam(team.id),
    entriesOverlapping: (range) => seam.listTeamEntriesOverlappingForTeam(team.id, range),
    // Out-of-scope 13: another team's busy days have no read, and the strip is not drawn (AC-9).
    busyDaysOverlapping: () => Promise.resolve([]),
    // EVT-03 AC-9. Never `seam.listEvents()`: an other-team view draws team B's relevant events.
    events: () => seam.listEventsForTeam(team.id),
  };
}
