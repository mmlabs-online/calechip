// SOLO, 2026-09-26 — report an issue, at the seam.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so nothing here is numbered `AC-n`:
// that prefix is a claim that a plan document states the criterion. `.claude/agents/solo.md` and the
// operator's four answers of 2026-09-26 are the authority, and those answers are transcribed in
// `supabase/migrations/20260926100000_solo_issue_report.sql`'s header.
//
// **THE MOCK IS THE SUBJECT AND THE POLICIES ARE WHAT IT REPRODUCES.** `issue_report_insert_own`,
// `issue_report_select_admin`, `issue_report_update_admin` and the three grants live in that
// migration and are exercised by NO test until a project is provisioned — RULE-09 keeps applying it
// human, and `tests/permission-model.test.ts` still does not exist
// (`.ai/standards/rbac-and-security.md` § Known weaknesses 1). What can be asserted here is that the
// mock admits where the policies admit and refuses where they refuse, and that matters because the
// acceptance suite drives the mock (BUG-001, `tests/e2e/seam.setup.ts`): a permissive mock would make
// every refusal on `IssueReports.tsx` pass against nothing at all.
//
// **EVERY TEST IS FOLLOWED BY A RESET, AND THE RESET EXISTS BECAUSE THE FEATURE HAS NO DELETE
// PATH.** The operator's third decision stopped at *mark done* — no delete policy, no grant, no seam
// function — so a test that sends a report cannot undo it through the seam. `__resetIssueReports` is
// a named export beside `seam`, like `__setCurrentMember`, and seam parity does not see either.
//
// **MIR-17, ADR-088 — `issue_report_select_admin`, `issue_report_update_admin` and
// `issue_image_select_admin` are gone (`20261107210000_mir16_issue_reports_system_scope.sql`).** Only
// a system admin at `aal2` reads or triages a report now (ADR-082 decision 1), so every read below
// answers every member-seam caller the same emptiness — AC-6 of MIR-17 `01-plan.md`. `allReports()`
// below reads `__storedIssueReports()` directly for exactly that reason: the seam itself no longer
// gives any caller, Quan included, a way to read one back.
import { afterEach, describe, expect, it } from "vitest";
import { seam as mock, __setCurrentMember, __resetIssueReports, __storedIssueReports } from "@/lib/data/mock";
import { seam as real } from "@/lib/data/supabase";
import {
  FIXTURE_ADMIN,
  FIXTURE_ISSUE_REPORT,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM_MEMBER,
} from "@/lib/fixtures";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

afterEach(() => {
  __setCurrentMember(null);
  __resetIssueReports();
});

/** Every report, exactly as stored. **MIR-17** reads the table directly rather than through the
 *  seam: since MIR-16 `listIssueReports` answers every caller, Quan included, with nothing (AC-6),
 *  so a test that needs to see what a write did reads `__storedIssueReports()` instead. */
async function allReports() {
  return __storedIssueReports();
}

describe("the fixture the table starts with", () => {
  it("is one open report, written by somebody who is not Quan", async () => {
    const rows = await allReports();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(FIXTURE_ISSUE_REPORT);
    // The property that made the list screen testable before MIR-16, and still worth pinning: the
    // fixture was not written by the person these tests call "the admin".
    expect(FIXTURE_ISSUE_REPORT.memberId).not.toBe(FIXTURE_ADMIN.id);
  });
});

describe("issue_report_insert_own — who may send one", () => {
  it("an ordinary member sends a report, and it is attributed to them", async () => {
    as(FIXTURE_MEMBER.id);
    const sent = await mock.createIssueReport({
      kind: "idea",
      message: "  Cho phép ghi chú dài hơn.  ",
      page: "/month",
    });
    expect(sent.ok).toBe(true);

    const mine = (await allReports()).find((r) => r.page === "/month");

    expect(mine?.memberId).toBe(FIXTURE_MEMBER.id);
    expect(mine?.kind).toBe("idea");
    // Stored TRIMMED, exactly as the real seam stores it: a seam that refused on the trimmed value
    // and stored the untrimmed one would disagree with itself about what it checked.
    expect(mine?.message).toBe("Cho phép ghi chú dài hơn.");
    // The column default. `status` is withheld from the insert grant, so nothing a caller sends can
    // reach it — a report cannot arrive already dealt with.
    expect(mine?.status).toBe("open");
  });

  it("somebody on another team sends one too — a report is about the product, not about a team", async () => {
    as(FIXTURE_OTHER_TEAM_MEMBER.id);
    const sent = await mock.createIssueReport({
      kind: "bug",
      message: "Không mở được màn hình năm.",
      page: "/year",
    });
    expect(sent.ok).toBe(true);

    expect((await allReports()).find((r) => r.page === "/year")?.memberId).toBe(
      FIXTURE_OTHER_TEAM_MEMBER.id,
    );
  });

  it("the newest is first, which is the order the real seam asks the datastore for", async () => {
    as(FIXTURE_MEMBER.id);
    const sent = await mock.createIssueReport({
      kind: "other",
      message: "Một báo cáo mới.",
      page: "/newest",
    });
    expect(sent.ok).toBe(true);

    const rows = await allReports();
    // The fixture was written on 2026-09-25 and this one now, so the new row sorts above it. A list
    // read oldest-first buries today's report under a year of history on the one screen whose job is
    // to surface what just arrived.
    expect(rows[0]?.page).toBe("/newest");
    expect(rows[1]?.id).toBe(FIXTURE_ISSUE_REPORT.id);
  });

  it("nobody at all is refused — `with check (member_id = auth.uid())` has nothing to compare", async () => {
    as(null);
    const sent = await mock.createIssueReport({
      kind: "other",
      message: "sent by nobody",
      page: "/week",
    });

    expect(sent.ok).toBe(false);
    if (!sent.ok) expect(sent.error.code).toBe("not_permitted");
    expect(await allReports()).toHaveLength(1);
  });
});

// MIR-17, ADR-088 — the three describes this used to be (`issue_report_select_admin`,
// `issue_report_update_admin` and `issueImageUrls`, the last of which lived further down beside the
// signed-URL suite) are one now, because MIR-16 left exactly one behaviour to assert across all four
// functions and it no longer depends on which caller is asking.
describe("MIR-17 AC-6 — the mock answers issue-report reads as the database does", () => {
  /** The stored row's own status, read directly — the one honest way left to check a write did or
   *  did not land, now that no read in this describe can see it either way. */
  const storedStatus = () =>
    __storedIssueReports().find((r) => r.id === FIXTURE_ISSUE_REPORT.id)?.status;

  /** AC-6, for whichever caller `as()` was just set to: every read is empty, the write is refused,
   *  and the row underneath is untouched by it. */
  async function assertAC6(): Promise<void> {
    const before = storedStatus();

    expect(await mock.listIssueReports()).toEqual([]);
    expect(await mock.countOpenIssueReports()).toBe(0);
    expect(await mock.issueImageUrls(["anybody/whatever.png"])).toEqual([null]);

    const result = await mock.setIssueReportStatus(FIXTURE_ISSUE_REPORT.id, "done");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_permitted");

    // Unchanged because the write above was REFUSED, not merely because nothing read it back.
    expect(storedStatus()).toBe(before);
  }

  it("as Quan — an org admin, who read every report until MIR-16", async () => {
    as(FIXTURE_ADMIN.id);
    await assertAC6();
  });

  it("as Thanh — a member, who was always refused", async () => {
    as(FIXTURE_MEMBER.id);
    await assertAC6();
  });

  it("with no session at all", async () => {
    as(null);
    await assertAC6();
  });
});

describe("the message rule, asserted against BOTH implementations", () => {
  // **THE ONLY ASSERTIONS IN THIS REPOSITORY THAT TOUCH `src/lib/data/supabase.ts`'s BEHAVIOUR**,
  // and they can because this rule runs entirely in the seam before any request is issued — no
  // client is constructed, no environment variable is read, nothing is sent. Everything else in that
  // file needs a provisioned project.
  //
  // They exist because the rule is written TWICE, which is the convention those two files keep for
  // every shared sentence. A copy that drifts has to fail something, and this is that something.
  const blank = { kind: "other" as const, message: "   ", page: "/week" };
  const tooLong = { kind: "other" as const, message: "x".repeat(2001), page: "/week" };

  it("a blank message is refused by the mock as `invalid_issue_message`", async () => {
    as(FIXTURE_MEMBER.id);
    const result = await mock.createIssueReport(blank);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_issue_message");
  });

  it("a blank message is refused by the real seam with the same code, before any request", async () => {
    const result = await real.createIssueReport(blank);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_issue_message");
  });

  it("an over-long message is refused by both, with the same code and the same sentence", async () => {
    as(FIXTURE_MEMBER.id);
    const mocked = await mock.createIssueReport(tooLong);
    const actual = await real.createIssueReport(tooLong);

    expect(mocked.ok).toBe(false);
    expect(actual.ok).toBe(false);
    if (!mocked.ok && !actual.ok) {
      expect(mocked.error.code).toBe("invalid_issue_message");
      // THE SENTENCE AND NOT ONLY THE CODE. The code is what a screen branches on; the sentence is
      // what a person reads, and a drifted copy would show two different ones for one condition
      // depending on which build somebody is running.
      expect(actual.error).toEqual(mocked.error);
    }
  });

  it("exactly 2000 characters is accepted — the boundary is `<=` and not `<`", async () => {
    as(FIXTURE_MEMBER.id);
    const sent = await mock.createIssueReport({
      kind: "other",
      message: "y".repeat(2000),
      page: "/limit",
    });
    expect(sent.ok).toBe(true);
  });

  it("the refusal happens BEFORE the author is resolved, so a blank message says so to nobody too", async () => {
    // The order inside `createIssueReport` matters and this pins it: the message is checked first,
    // so somebody with a blank message is told about the message rather than about a session. The
    // reverse order would tell a signed-out person the wrong thing about a form they had not filled.
    as(null);
    const result = await mock.createIssueReport(blank);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_issue_message");
  });
});

// ---------------------------------------------------------------------------
// SOLO, 2026-09-26 (second run) — the optional images.
//
// **THE STORAGE POLICIES ARE ASSERTED BY NOTHING HERE, AND THAT HAS TO BE SAID OUT LOUD.**
// `issue_image_insert_own` and `issue_image_select_admin` live on `storage.objects`, Supabase's own
// table, which the mock has no equivalent of — it keeps a `Map`. So these tests cover the seam's
// refusals, the path SHAPE the insert policy depends on, and the fact that a non-admin is answered
// nothing loadable. They cover the two policies themselves not at all.
// ---------------------------------------------------------------------------

/** A file of `bytes` bytes with a given MIME type. `File` exists in node 20+ and in every browser,
 *  so one helper serves the vitest run and would serve a browser one. */
const fileOf = (name: string, type: string, bytes = 8): File =>
  new File([new Uint8Array(bytes)], name, { type });

describe("the image rules, asserted against BOTH implementations", () => {
  const base = { kind: "bug" as const, message: "It broke.", page: "/week" };

  it("a fourth image is refused, by both, with the same sentence", async () => {
    const images = [
      fileOf("a.png", "image/png"),
      fileOf("b.png", "image/png"),
      fileOf("c.png", "image/png"),
      fileOf("d.png", "image/png"),
    ];

    as(FIXTURE_MEMBER.id);
    const mocked = await mock.createIssueReport({ ...base, images });
    const actual = await real.createIssueReport({ ...base, images });

    expect(mocked.ok).toBe(false);
    expect(actual.ok).toBe(false);
    if (!mocked.ok && !actual.ok) {
      expect(mocked.error.code).toBe("invalid_issue_image");
      expect(actual.error).toEqual(mocked.error);
    }
    // And nothing was written. The refusal is BEFORE the upload, which is the property that stops
    // somebody paying for three uploads to be told about the fourth.
    expect(await allReports()).toHaveLength(1);
  });

  it("a type the bucket does not accept is refused, and TYPE is checked before SIZE", async () => {
    // A PDF that is also far too large. Somebody who attached it should be told what is wrong with
    // it rather than sent to compress a file that would be refused at any size — so the sentence
    // must be the type one.
    const images = [fileOf("notes.pdf", "application/pdf", 6 * 1024 * 1024)];

    as(FIXTURE_MEMBER.id);
    const mocked = await mock.createIssueReport({ ...base, images });
    const actual = await real.createIssueReport({ ...base, images });

    expect(mocked.ok).toBe(false);
    if (!mocked.ok) expect(mocked.error.message).toContain("PNG");
    if (!mocked.ok && !actual.ok) expect(actual.error).toEqual(mocked.error);
  });

  it("an image over 5 MB is refused", async () => {
    const images = [fileOf("huge.png", "image/png", 5 * 1024 * 1024 + 1)];

    as(FIXTURE_MEMBER.id);
    const result = await mock.createIssueReport({ ...base, images });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_issue_image");
      expect(result.error.message).toContain("5 MB");
    }
  });

  it("exactly three images of an accepted type are sent, and the paths carry the author's id", async () => {
    as(FIXTURE_MEMBER.id);
    const sent = await mock.createIssueReport({
      ...base,
      page: "/three",
      images: [
        fileOf("one.png", "image/png"),
        fileOf("two.jpg", "image/jpeg"),
        fileOf("three.webp", "image/webp"),
      ],
    });
    expect(sent.ok).toBe(true);

    const row = (await allReports()).find((r) => r.page === "/three");
    expect(row?.images).toHaveLength(3);

    // **THE PATH SHAPE IS WHAT `issue_image_insert_own` DEPENDS ON**, and it is the one thing about
    // storage this suite can assert: that policy compares `(storage.foldername(name))[1]` with
    // `auth.uid()`, so a flat path or a path built from anything else would be refused by the real
    // bucket while passing every test here. Pinning the prefix is what makes that visible.
    for (const path of row?.images ?? []) {
      expect(path.startsWith(`${FIXTURE_MEMBER.id}/`)).toBe(true);
    }
  });

  it("a report with no images is the ordinary case, and `images` is an empty array", async () => {
    as(FIXTURE_MEMBER.id);
    const sent = await mock.createIssueReport({ ...base, page: "/none" });
    expect(sent.ok).toBe(true);

    expect((await allReports()).find((r) => r.page === "/none")?.images).toEqual([]);
  });
});

// `issueImageUrls`'s own describe moved into "MIR-17 AC-6" above — ADR-088, the mock now answers
// it the same unconditional `null` for every caller, so there was nothing role-specific left here to
// keep separate.

describe("countOpenIssueReports — the number behind the tab badge", () => {
  it("answers 0 for an admin too, and the row a refused write named is untouched", async () => {
    as(FIXTURE_ADMIN.id);
    expect(await mock.countOpenIssueReports()).toBe(0);

    const before = (await allReports()).find((r) => r.id === FIXTURE_ISSUE_REPORT.id)?.status;
    await mock.setIssueReportStatus(FIXTURE_ISSUE_REPORT.id, "done");
    const after = (await allReports()).find((r) => r.id === FIXTURE_ISSUE_REPORT.id)?.status;

    // Unchanged because MIR-16 refuses the write, not merely because nothing shows it afterwards.
    expect(after).toBe(before);
    expect(await mock.countOpenIssueReports()).toBe(0);
  });

  it("an ordinary member is answered 0 rather than refused", async () => {
    as(FIXTURE_MEMBER.id);
    // Since MIR-16, `issue_report_select_admin` is gone and nobody reads a report at all — so the
    // badge is absent by construction rather than by a branch, and nothing leaks either way.
    expect(await mock.countOpenIssueReports()).toBe(0);
  });

  it("nobody at all is answered 0", async () => {
    as(null);
    expect(await mock.countOpenIssueReports()).toBe(0);
  });

  // SOLO, 2026-09-26 (third run) — the second badge, asserted beside the first because the operator
  // asked for *the same number* and the two must therefore behave the same way. It lives in this
  // file rather than one of its own: what is being pinned is that the pair agree, and splitting them
  // would leave nothing asserting that.
  it("the sign-up queue is counted the same way, and agrees with its own list", async () => {
    as(FIXTURE_ADMIN.id);
    const waiting = (await mock.listPendingMembers()).length;

    expect(waiting).toBeGreaterThan(0); // FIXTURE_PENDING_SIGNUP, so the badge is never vacuously 0
    expect(await mock.countPendingMembers()).toBe(waiting);
  });

  it("an ordinary member counts no sign-ups either", async () => {
    as(FIXTURE_MEMBER.id);
    // `member_select_pending_admin` filters. Both badges are absent for a non-admin by arithmetic
    // rather than by a branch in the strip — the issue-reports one is absent for everybody now (MIR-16).
    expect(await mock.countPendingMembers()).toBe(0);
  });

  it("nobody at all counts no sign-ups", async () => {
    as(null);
    expect(await mock.countPendingMembers()).toBe(0);
  });

  it("agrees with the list it is a count of", async () => {
    as(FIXTURE_MEMBER.id);
    await mock.createIssueReport({ kind: "idea", message: "Another one.", page: "/again" });

    as(FIXTURE_ADMIN.id);
    const listed = (await mock.listIssueReports()).filter((r) => r.status === "open").length;
    // The badge and the screen must not be able to say different numbers. They are two functions
    // over one array here and two queries there, which is exactly where they could drift.
    expect(await mock.countOpenIssueReports()).toBe(listed);
  });
});

describe("the refusal order across the two rules", () => {
  it("a blank message beats a fourth image — the message is checked first", async () => {
    // `issueMessageFailure(...) ?? issueImageFailure(...)` is the expression in both implementations,
    // and this is what pins which of the two sentences a person sees when both are true. The message
    // is the field they were actually working in, so it is the one to name; the reverse order would
    // send somebody to remove an attachment while the box above it was still empty.
    as(FIXTURE_MEMBER.id);
    const result = await mock.createIssueReport({
      kind: "bug",
      message: "   ",
      page: "/week",
      images: [
        fileOf("a.png", "image/png"),
        fileOf("b.png", "image/png"),
        fileOf("c.png", "image/png"),
        fileOf("d.png", "image/png"),
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_issue_message");
  });
});
