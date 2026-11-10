// UIE-12 — what the join block shows. 01-plan.md § 2 AC-16; § 4.1's table, one case per row.
//
// Rows 1, 2, 3, 5 and 6 together are EVT-02's `canJoin`; rows 4 and 5 are G1's two sentences. The
// function decides an AFFORDANCE (ADR-005) — the guard is the control, and nothing here asserts it.
import { describe, expect, it } from "vitest";
import type { AttendanceStatus, CalEvent, EventAttendance, Member } from "@/lib/domain/types";
import { joinBarState } from "@/components/EventJoinBar";
import { FIXTURE_ADMIN, FIXTURE_MEMBER, FIXTURE_OTHER_TEAM_MEMBER, FIXTURE_TEAM } from "@/lib/fixtures";

const EVENT: CalEvent = {
  id: "e0000000-0000-4000-8000-000000000001",
  creatorId: FIXTURE_ADMIN.id,
  teamId: FIXTURE_TEAM.id,
  name: "Picnic",
  description: null,
  location: null,
  startDate: "2026-11-01",
  endDate: "2026-11-01",
  scope: "public",
  capacity: 2,
  requiresApproval: false,
  registrationDeadline: null,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};

const row = (memberId: string, status: AttendanceStatus): EventAttendance => ({
  eventId: EVENT.id,
  memberId,
  status,
  createdAt: "2026-10-02T00:00:00Z",
  updatedAt: "2026-10-02T00:00:00Z",
});

function state(over: {
  event?: Partial<CalEvent>;
  me?: Member | null;
  rows?: EventAttendance[] | null;
  taken?: number;
  open?: boolean;
}) {
  return joinBarState({
    event: { ...EVENT, ...over.event },
    me: over.me === undefined ? FIXTURE_MEMBER : over.me,
    invitees: [],
    rows: over.rows === undefined ? [] : over.rows,
    taken: over.taken ?? 0,
    open: over.open ?? true,
  });
}

describe("UIE-12 AC-16 — joinBarState, § 4.1's table", () => {
  it("row 1: hidden until the attendance load answers", () => {
    expect(state({ rows: null })).toEqual({ kind: "hidden" });
  });

  it("row 2: the reader's own row, each status, open and closed", () => {
    const statuses: AttendanceStatus[] = ["pending", "attending", "rejected", "removed"];
    for (const status of statuses) {
      const leavable = status === "pending" || status === "attending";
      expect(state({ rows: [row(FIXTURE_MEMBER.id, status)], open: true })).toEqual({
        kind: "status",
        status,
        canLeave: leavable,
      });
      expect(state({ rows: [row(FIXTURE_MEMBER.id, status)], open: false })).toEqual({
        kind: "status",
        status,
        canLeave: false,
      });
    }
  });

  it("row 2 wins over full and closed: a reader with a row always sees it", () => {
    expect(state({ rows: [row(FIXTURE_MEMBER.id, "attending")], taken: 2, open: false }).kind).toBe("status");
  });

  it("row 3: hidden for a reader outside the audience, and for nobody signed in", () => {
    // EVT-02 AC-11. An own-team event of the other team, created by someone on it.
    const theirs: Partial<CalEvent> = {
      scope: "team",
      creatorId: FIXTURE_OTHER_TEAM_MEMBER.id,
      teamId: FIXTURE_OTHER_TEAM_MEMBER.teamId!,
    };
    expect(state({ me: FIXTURE_ADMIN, event: theirs })).toEqual({ kind: "hidden" });
    expect(state({ me: FIXTURE_MEMBER, event: theirs })).toEqual({ kind: "hidden" });
    expect(state({ me: null })).toEqual({ kind: "hidden" });
    // Row 3 before row 4: an outsider is not told registration closed.
    expect(state({ me: null, open: false })).toEqual({ kind: "hidden" });
  });

  it("row 4: closed, for a reader in the audience with no row", () => {
    expect(state({ open: false })).toEqual({ kind: "closed" });
    expect(state({ open: false, taken: 2 })).toEqual({ kind: "closed" });
  });

  it("row 5: full, only without approval", () => {
    expect(state({ taken: 2 })).toEqual({ kind: "full" });
    expect(state({ taken: 3 })).toEqual({ kind: "full" });
    // A request holds no seat (EVT-02), so a full event with approval still takes one.
    expect(state({ taken: 2, event: { requiresApproval: true } })).toEqual({ kind: "join", requiresApproval: true });
  });

  it("row 6: join, with and without approval, and with no seat limit", () => {
    expect(state({ taken: 1 })).toEqual({ kind: "join", requiresApproval: false });
    expect(state({ taken: 1, event: { requiresApproval: true } })).toEqual({ kind: "join", requiresApproval: true });
    expect(state({ taken: 50, event: { capacity: null } })).toEqual({ kind: "join", requiresApproval: false });
  });

  it("another member's row is not the reader's", () => {
    expect(state({ rows: [row(FIXTURE_OTHER_TEAM_MEMBER.id, "attending")], taken: 1 })).toEqual({
      kind: "join",
      requiresApproval: false,
    });
  });
});
