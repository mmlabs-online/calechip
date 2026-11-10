// MIR-02 — a member's own role, status and team change only through bounded, definer-checked paths.
// `.ai/board/tickets/MIR-02/01-plan.md` § 2 and § 4.6; ADR-064.
//
// **THE MOCK IS THE SUBJECT, AND THIS IS NOT THE VERIFICATION OF RECORD.** The control is the
// migration `supabase/migrations/20261020120000_mir02_member_self_writes.sql` — a column revoke and a
// trigger clause — and no test reaches a database until MIR-05 brings pgTAP. Until then AC-1 to AC-6
// are verified by hand, by the steps in `.ai/board/tickets/MIR-02/verification.md`. What is asserted
// here is that the seam the acceptance suite drives still admits what the definer functions admit,
// refuses what they refuse, and refuses an admin moving themselves (AC-11), which the mock allowed.
//
// ORDER MATTERS IN THE SIGN-UP BLOCK, and nothing restores it: the mock offers no reseed, and a
// rejection is one-way. Vitest isolates module state per file, so the pending fixture is spent in
// this file only.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { seam, __setCurrentMember } from "@/lib/data/mock";
import { AVATAR_CHOICES } from "@/lib/domain/types";
import {
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_PENDING_SIGNUP,
  FIXTURE_TEAM,
} from "@/lib/fixtures";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

afterEach(() => __setCurrentMember(null));

const DECISION_REFUSED = "That sign-up could not be decided. It may already have been.";
const TEAM_SAVE_REFUSED = "That member could not be moved.";
const MOVE_REFUSED = "That person could not be moved.";

describe("MIR-02 — moves and ranks through the definer functions", () => {
  it("an admin cannot move themselves to another team", async () => {
    as(FIXTURE_ADMIN.id);
    const result = await seam.moveMember(FIXTURE_ADMIN.id, FIXTURE_OTHER_TEAM.id);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_permitted");
      expect(result.error.message).toBe(MOVE_REFUSED);
    }
    // And the row did not move.
    expect((await seam.getCurrentMember())?.teamId).toBe(FIXTURE_TEAM.id);
  });

  it("an admin still moves somebody else to another team", async () => {
    as(FIXTURE_ADMIN.id);
    const moved = await seam.moveMember(FIXTURE_OTHER_TEAM_MEMBER.id, FIXTURE_TEAM.id);
    expect(moved.ok).toBe(true);

    // Put them back, and fail loudly rather than leave the roster changed.
    const back = await seam.moveMember(FIXTURE_OTHER_TEAM_MEMBER.id, FIXTURE_OTHER_TEAM.id);
    expect(back.ok).toBe(true);
  });

  it("an admin still sets somebody else's rank", async () => {
    as(FIXTURE_ADMIN.id);
    const promoted = await seam.setMemberRole(FIXTURE_MEMBER.id, "manager");

    expect(promoted.ok).toBe(true);
    if (promoted.ok) {
      expect(promoted.value.role).toBe("manager");
      expect(promoted.value.teamId).toBe(FIXTURE_MEMBER.teamId);
    }

    const back = await seam.setMemberRole(FIXTURE_MEMBER.id, "member");
    expect(back.ok).toBe(true);
  });
});

describe("MIR-02 — rejecting a sign-up through `reject_member`", () => {
  // First, while the sign-up is still waiting: the refusal must be about the caller, not the row.
  it("a member cannot reject a sign-up", async () => {
    as(FIXTURE_MEMBER.id);
    const result = await seam.decideMember(FIXTURE_PENDING_SIGNUP.id, { approve: false });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_permitted");
      expect(result.error.message).toBe(DECISION_REFUSED);
    }

    as(FIXTURE_ADMIN.id);
    expect((await seam.listPendingMembers()).map((m) => m.id)).toContain(FIXTURE_PENDING_SIGNUP.id);
  });

  it("an admin still rejects a pending sign-up", async () => {
    as(FIXTURE_ADMIN.id);
    const result = await seam.decideMember(FIXTURE_PENDING_SIGNUP.id, { approve: false });

    expect(result.ok).toBe(true);
    expect((await seam.listPendingMembers()).map((m) => m.id)).not.toContain(
      FIXTURE_PENDING_SIGNUP.id,
    );
  });

  it("rejecting somebody already decided is refused, with the shipped sentence", async () => {
    as(FIXTURE_ADMIN.id);

    // Already rejected, by the test above.
    const again = await seam.decideMember(FIXTURE_PENDING_SIGNUP.id, { approve: false });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error.code).toBe("not_permitted");
      expect(again.error.message).toBe(DECISION_REFUSED);
    }

    // Already approved, and still on their team afterwards.
    const approved = await seam.decideMember(FIXTURE_MEMBER.id, { approve: false });
    expect(approved.ok).toBe(false);
    if (!approved.ok) expect(approved.error.message).toBe(DECISION_REFUSED);
    const roster = await seam.listMembers();
    const row = roster.find((m) => m.id === FIXTURE_MEMBER.id);
    expect(row?.status).toBe("approved");
    expect(row?.teamId).toBe(FIXTURE_TEAM.id);
  });
});

describe("MIR-02 — the member edit panel through `set_member_team`", () => {
  it("the member edit panel still saves a member of the admin's own team", async () => {
    as(FIXTURE_ADMIN.id);
    const result = await seam.setMemberTeam(FIXTURE_MEMBER.id, FIXTURE_TEAM.id);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.teamId).toBe(FIXTURE_TEAM.id);
  });

  it("the edit panel refuses a member of another team", async () => {
    as(FIXTURE_ADMIN.id);
    const across = await seam.setMemberTeam(FIXTURE_OTHER_TEAM_MEMBER.id, FIXTURE_TEAM.id);
    expect(across.ok).toBe(false);
    if (!across.ok) {
      expect(across.error.code).toBe("not_permitted");
      expect(across.error.message).toBe(TEAM_SAVE_REFUSED);
    }

    // A destination that is not the admin's own team, and a caller who is not an admin.
    const away = await seam.setMemberTeam(FIXTURE_MEMBER.id, FIXTURE_OTHER_TEAM.id);
    expect(away.ok).toBe(false);
    if (!away.ok) expect(away.error.message).toBe(TEAM_SAVE_REFUSED);

    as(FIXTURE_MEMBER.id);
    const notAdmin = await seam.setMemberTeam(FIXTURE_MEMBER.id, FIXTURE_TEAM.id);
    expect(notAdmin.ok).toBe(false);
    if (!notAdmin.ok) expect(notAdmin.error.message).toBe(TEAM_SAVE_REFUSED);
  });
});

describe("MIR-02 — the profile write is untouched", () => {
  it("a member still edits their own display name and avatar", async () => {
    const other = AVATAR_CHOICES.find((name) => name !== FIXTURE_MEMBER.avatar);
    if (!other) throw new Error("public/images/ must hold an image besides the fixture member's own");

    as(FIXTURE_MEMBER.id);
    const before = await seam.getCurrentMember();
    const result = await seam.updateOwnProfile({ displayName: "Đổi tên", avatar: other });

    expect(result.ok).toBe(true);
    const after = await seam.getCurrentMember();
    expect(after?.displayName).toBe("Đổi tên");
    expect(after?.avatar).toBe(other);
    // Nothing else on the row moved — the three columns MIR-02 is about included.
    expect(after?.role).toBe(before?.role);
    expect(after?.status).toBe(before?.status);
    expect(after?.teamId).toBe(before?.teamId);

    const back = await seam.updateOwnProfile({
      displayName: FIXTURE_MEMBER.displayName,
      avatar: FIXTURE_MEMBER.avatar,
    });
    expect(back.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-1 to AC-6, guarded only. Static, over the migration text with `--` comment lines stripped —
// the shape tests/cross-team-reads.test.ts uses, because the migration discusses the clause in prose
// and a scanner reading the prose would pass on the explanation rather than the statement.
// **NOT VERIFICATION**: a guard against the file being lost or reshaped before MIR-05 can run it.
// ---------------------------------------------------------------------------

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const MIGRATION_PATH = "supabase/migrations/20261020120000_mir02_member_self_writes.sql";

describe("MIR-02 — the migration", () => {
  it("the migration revokes role, status and team_id and adds the self clause", () => {
    const code = readFileSync(repoRoot + MIGRATION_PATH, "utf8")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .replace(/\s+/g, " ")
      .toLowerCase();

    expect(code).toContain(
      "revoke update (role, status, team_id) on public.member from authenticated;",
    );
    expect(code).toContain("if v_uid is not null and old.id = v_uid and (");
    expect(code).toContain("new.role is distinct from old.role");
    expect(code).toContain("new.status is distinct from old.status");
    expect(code).toContain("new.team_id is distinct from old.team_id");
  });
});
