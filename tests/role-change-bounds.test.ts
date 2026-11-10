// MIR-03 — role changes are bounded to the admin's own team, promotion to admin is its own action,
// and every role change records its actor. `.ai/board/tickets/MIR-03/01-plan.md` § 4.6, ADR-065.
//
// **THE MOCK IS THE SUBJECT.** `public.set_member_role` and `public.promote_member_to_admin` live in
// `supabase/migrations/20261020150000_mir03_bounded_role_changes.sql`, which no test runs (RULE-09).
// What is asserted here is that the mock admits where the functions admit and refuses where they
// refuse. The `member_role_change` record is not kept by the mock (plan § 4.3); its clauses of AC-1,
// AC-4, AC-9 and AC-10 are verified in `.ai/board/tickets/MIR-03/verification.md` only.
//
// EVERY TEST RESTORES WHAT IT WROTE, except the promotion, which cannot: it is last in the file and
// aimed at FIXTURE_APPROVED_MEMBER, whom nothing before it depends on.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { seam, __setCurrentMember } from "@/lib/data/mock";
import {
  FIXTURE_ADMIN,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_REMOVED_MEMBER,
  FIXTURE_SECOND_ADMIN,
} from "@/lib/fixtures";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

afterEach(() => __setCurrentMember(null));

const NOBODY = "00000000-0000-4000-8000-000000000000";
const RANK_REFUSED = "That person's role could not be changed.";
const PROMOTE_REFUSED = "That person could not be promoted.";

/** The admin's view of one member, read back through the own-team roster. */
async function roleOf(memberId: string): Promise<string | undefined> {
  as(FIXTURE_ADMIN.id);
  return (await seam.listMembers()).find((m) => m.id === memberId)?.role;
}

describe("MIR-03 — the rank write is own-team and refuses admin", () => {
  it("an admin makes a member of their own team a manager and back", async () => {
    expect(FIXTURE_MEMBER.teamId).toBe(FIXTURE_ADMIN.teamId);
    as(FIXTURE_ADMIN.id);

    const up = await seam.setMemberRole(FIXTURE_MEMBER.id, "manager");
    expect(up.ok).toBe(true);
    if (up.ok) {
      expect(up.value.role).toBe("manager");
      // INV-07: the rank moved and the team did not.
      expect(up.value.teamId).toBe(FIXTURE_MEMBER.teamId);
    }

    const down = await seam.setMemberRole(FIXTURE_MEMBER.id, "member");
    expect(down.ok).toBe(true);
    if (down.ok) {
      expect(down.value.role).toBe("member");
      expect(down.value.teamId).toBe(FIXTURE_MEMBER.teamId);
    }
  });

  it("an admin cannot set the rank of another team's member", async () => {
    expect(FIXTURE_OTHER_TEAM_MEMBER.teamId).not.toBe(FIXTURE_ADMIN.teamId);
    as(FIXTURE_ADMIN.id);

    const result = await seam.setMemberRole(FIXTURE_OTHER_TEAM_MEMBER.id, "manager");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_permitted");
      expect(result.error.message).toBe(RANK_REFUSED);
    }

    const roster = await seam.listMembersForTeam(FIXTURE_OTHER_TEAM_MEMBER.teamId ?? "");
    expect(roster.find((m) => m.id === FIXTURE_OTHER_TEAM_MEMBER.id)?.role).toBe("member");
  });

  it("the rank write refuses admin, even on the admin's own team", async () => {
    as(FIXTURE_ADMIN.id);

    const result = await seam.setMemberRole(FIXTURE_MEMBER.id, "admin");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_permitted");

    expect(await roleOf(FIXTURE_MEMBER.id)).toBe("member");
  });
});

describe("MIR-03 — promotion is own-team", () => {
  it("an admin cannot promote another team's member", async () => {
    as(FIXTURE_ADMIN.id);

    const result = await seam.promoteMember(FIXTURE_OTHER_TEAM_MEMBER.id);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_permitted");
      expect(result.error.message).toBe(PROMOTE_REFUSED);
    }

    const roster = await seam.listMembersForTeam(FIXTURE_OTHER_TEAM_MEMBER.teamId ?? "");
    expect(roster.find((m) => m.id === FIXTURE_OTHER_TEAM_MEMBER.id)?.role).toBe("member");
  });
});

describe("MIR-03 — only an admin changes a rank or promotes", () => {
  it("a member cannot set a rank or promote", async () => {
    as(FIXTURE_MEMBER.id);

    expect((await seam.setMemberRole(FIXTURE_APPROVED_MEMBER.id, "manager")).ok).toBe(false);
    expect((await seam.promoteMember(FIXTURE_APPROVED_MEMBER.id)).ok).toBe(false);

    expect(await roleOf(FIXTURE_APPROVED_MEMBER.id)).toBe("member");
  });

  it("a manager cannot set a rank or promote", async () => {
    as(FIXTURE_ADMIN.id);
    const made = await seam.setMemberRole(FIXTURE_MEMBER.id, "manager");
    if (!made.ok) throw new Error(`could not make a manager: ${made.error.code}`);

    as(FIXTURE_MEMBER.id);
    const rank = await seam.setMemberRole(FIXTURE_APPROVED_MEMBER.id, "manager");
    const promote = await seam.promoteMember(FIXTURE_APPROVED_MEMBER.id);

    // Restore before asserting, so a failed assertion does not leave the roster changed.
    as(FIXTURE_ADMIN.id);
    const back = await seam.setMemberRole(FIXTURE_MEMBER.id, "member");
    if (!back.ok) throw new Error(`could not restore the rank: ${back.error.code}`);

    expect(rank.ok).toBe(false);
    expect(promote.ok).toBe(false);

    expect(await roleOf(FIXTURE_APPROVED_MEMBER.id)).toBe("member");
  });

  it("nobody signed in cannot set a rank or promote", async () => {
    as(null);

    expect((await seam.setMemberRole(FIXTURE_MEMBER.id, "manager")).ok).toBe(false);
    expect((await seam.promoteMember(FIXTURE_MEMBER.id)).ok).toBe(false);

    expect(await roleOf(FIXTURE_MEMBER.id)).toBe("member");
  });
});

describe("MIR-03 — the row conditions on both paths", () => {
  it("a removed member, an admin, and an unknown id are refused on both paths with one answer each", async () => {
    // All three are on the admin's own team (or nowhere), so the team condition is not what refuses.
    expect(FIXTURE_REMOVED_MEMBER.teamId).toBe(FIXTURE_ADMIN.teamId);
    expect(FIXTURE_SECOND_ADMIN.teamId).toBe(FIXTURE_ADMIN.teamId);
    as(FIXTURE_ADMIN.id);

    for (const id of [FIXTURE_REMOVED_MEMBER.id, FIXTURE_SECOND_ADMIN.id, NOBODY]) {
      const rank = await seam.setMemberRole(id, "manager");
      expect(rank.ok).toBe(false);
      if (!rank.ok) {
        expect(rank.error.code).toBe("not_permitted");
        expect(rank.error.message).toBe(RANK_REFUSED);
      }

      const promote = await seam.promoteMember(id);
      expect(promote.ok).toBe(false);
      if (!promote.ok) {
        expect(promote.error.code).toBe("not_permitted");
        expect(promote.error.message).toBe(PROMOTE_REFUSED);
      }
    }

    expect(await roleOf(FIXTURE_SECOND_ADMIN.id)).toBe("admin");
  });
});

// ---------------------------------------------------------------------------
// AC-1 to AC-10, guarded only. Static, over the migration text with `--` comment lines stripped,
// the shape tests/member-self-writes.test.ts uses. **NOT VERIFICATION**: a guard against the file
// being lost or reshaped before MIR-05 can run it.
// ---------------------------------------------------------------------------

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const MIGRATION_PATH = "supabase/migrations/20261020150000_mir03_bounded_role_changes.sql";

describe("MIR-03 — the migration", () => {
  it("the migration bounds set_member_role, adds promote_member_to_admin and records every role change", () => {
    const code = readFileSync(repoRoot + MIGRATION_PATH, "utf8")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .replace(/\s+/g, " ")
      .toLowerCase();

    const OWN_TEAM = "and m.team_id = public.member_team_id((select auth.uid()))";
    const rankStart = code.indexOf("create or replace function public.set_member_role(");
    const promoteStart = code.indexOf("create or replace function public.promote_member_to_admin(");
    expect(rankStart).toBeGreaterThan(-1);
    expect(promoteStart).toBeGreaterThan(rankStart);

    const rankBody = code.slice(rankStart, promoteStart);
    const promoteBody = code.slice(promoteStart);
    expect(rankBody).toContain(OWN_TEAM);
    expect(promoteBody).toContain(OWN_TEAM);
    expect(rankBody).toContain("if p_role = 'admin'::public.member_role then");

    expect(code).toContain("create table if not exists public.member_role_change (");
    expect(code).toContain("alter table public.member_role_change enable row level security;");
    expect(code).toContain(
      "revoke all on table public.member_role_change from public, anon, authenticated;",
    );
    expect(code).toContain(
      "after update of role on public.member for each row when (old.role is distinct from new.role)",
    );
    expect(code).toContain(
      "grant execute on function public.promote_member_to_admin(uuid) to authenticated;",
    );
  });
});

describe("MIR-03 — promotion on the own team", () => {
  // **LAST IN THE FILE, AND IT HAS TO BE.** Promotion is one-way, so this cannot put back what it
  // writes. FIXTURE_APPROVED_MEMBER is a member every test above leaves as it found.
  it("an admin promotes a member of their own team to admin", async () => {
    expect(FIXTURE_APPROVED_MEMBER.teamId).toBe(FIXTURE_ADMIN.teamId);
    as(FIXTURE_ADMIN.id);

    const result = await seam.promoteMember(FIXTURE_APPROVED_MEMBER.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.role).toBe("admin");
      // INV-07.
      expect(result.value.teamId).toBe(FIXTURE_APPROVED_MEMBER.teamId);
    }

    // One-way: the rank write cannot bring them back.
    const back = await seam.setMemberRole(FIXTURE_APPROVED_MEMBER.id, "member");
    expect(back.ok).toBe(false);
    expect(await roleOf(FIXTURE_APPROVED_MEMBER.id)).toBe("admin");
  });
});
