// EVT-05 — event email. Every acceptance criterion that is a property of the data, through the mock
// seam; the words and the layout through the pure template; the migration's shape by reading it.
//
// **THE MOCK REPRODUCES `supabase/migrations/20261009090000_evt05_event_email.sql`; IT CANNOT PROVE
// IT.** `tests/permission-model.test.ts` against a real PostgreSQL is still owed project-wide
// (.ai/standards/rbac-and-security.md § Known weaknesses 1). The trigger, the RPC and the grants are
// asserted by reading the file, the way `tests/notifications.test.ts` reads EVT-04's. The first real
// send is a human step (ADR-053, TODO(verify) on port 465).
//
// **PEOPLE.** Fixtures as they are; anyone else is created through the seam as a person would be
// (sign up, then an admin decides), as `tests/notifications.test.ts` does. No fixture file is edited.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { SaveEventInput } from "@/lib/data";
import {
  seam as mock,
  __resetEvents,
  __sentEventEmails,
  __setCurrentMember,
  type MockEventEmail,
} from "@/lib/data/mock";
import type { NotificationKind } from "@/lib/domain/types";
import { notificationSentence } from "@/components/NotificationBell";
import {
  formatEventDates,
  formatEventWeekdays,
  parseEventEmailRequest,
  renderEventEmail,
  type EventEmailKind,
  type EventEmailRequest,
} from "../supabase/functions/send-event-email/template";
import {
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_TEAM,
} from "@/lib/fixtures";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

const MIGRATION = read("../supabase/migrations/20261009090000_evt05_event_email.sql");
const EVT04 = read("../supabase/migrations/20261008120000_evt04_notification.sql");
const SENDER = read("../supabase/functions/send-event-email/index.ts");

/** A migration with its `--` comments removed — the header names things in order to say they are not
 *  done; the assertions below are about the statements. */
const strip = (sql: string): string => sql.replace(/--[^\n]*/g, "");
const SQL = strip(MIGRATION);

function functionBody(name: string): string {
  const match = SQL.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`));
  if (!match) throw new Error(`no function ${name} in the migration`);
  return match[0];
}

const EMAIL_KINDS: EventEmailKind[] = [
  "event_created",
  "event_invited",
  "attendance_approved",
  "attendance_rejected",
  "attendance_removed",
];

const input = (overrides: Partial<SaveEventInput> = {}): SaveEventInput => ({
  name: "Team lunch",
  description: null,
  location: null,
  startDate: "2099-03-10",
  endDate: "2099-03-10",
  scope: "team",
  inviteeIds: [],
  ...overrides,
});

async function createAs(memberId: string, overrides: Partial<SaveEventInput> = {}): Promise<string> {
  as(memberId);
  const result = await mock.createEvent(input(overrides));
  if (!result.ok) throw new Error(`createEvent refused: ${result.error.code}`);
  return result.value.id;
}

async function updateAs(memberId: string, eventId: string, overrides: Partial<SaveEventInput> = {}) {
  as(memberId);
  const result = await mock.updateEvent(eventId, input(overrides));
  if (!result.ok) throw new Error(`updateEvent refused: ${result.error.code}`);
}

async function joinAs(memberId: string, eventId: string): Promise<void> {
  as(memberId);
  const result = await mock.joinEvent(eventId);
  if (!result.ok) throw new Error(`joinEvent refused: ${result.error.code}`);
}

async function decideAs(
  memberId: string,
  eventId: string,
  who: string,
  status: "attending" | "rejected" | "removed",
): Promise<void> {
  as(memberId);
  const result = await mock.decideAttendance(eventId, who, status);
  if (!result.ok) throw new Error(`decideAttendance refused: ${result.error.code}`);
}

async function switchAs(memberId: string, enabled: boolean): Promise<void> {
  as(memberId);
  const result = await mock.setEventEmailEnabled(enabled);
  if (!result.ok) throw new Error(`setEventEmailEnabled refused: ${result.error.code}`);
}

/** The emails handed over, as `kind → address` pairs for one event. */
const mailFor = (eventId: string): MockEventEmail[] =>
  __sentEventEmails().filter((e) => e.eventId === eventId);

const emailOf = async (memberId: string): Promise<string> => {
  as(FIXTURE_ADMIN.id);
  const all = await mock.listMembers();
  const row =
    all.find((m) => m.id === memberId) ??
    (await (async () => {
      as(memberId);
      return mock.getCurrentMember();
    })());
  if (!row || !row.email) throw new Error(`no address for ${memberId}`);
  return row.email;
};

async function signUp(displayName: string): Promise<string> {
  const email = `${displayName.toLowerCase().replace(/\s+/g, ".")}@evt05.example.com`;
  const result = await mock.signUp({ email, password: "password123", displayName, avatar: "" });
  if (!result.ok) throw new Error(`signUp refused: ${result.error.code}`);
  as(FIXTURE_ADMIN.id);
  const found = (await mock.listPendingMembers()).find((m) => m.email === email);
  if (!found) throw new Error(`${displayName} is not waiting`);
  return found.id;
}

async function approved(displayName: string, teamId: string): Promise<string> {
  const id = await signUp(displayName);
  as(FIXTURE_ADMIN.id);
  const decided = await mock.decideMember(id, { approve: true, teamId });
  if (!decided.ok) throw new Error(`approve refused: ${decided.error.code}`);
  return id;
}

let MEMBER_A2 = "";
let MEMBER_B2 = "";
let LEAVER = "";

beforeAll(async () => {
  MEMBER_A2 = await approved("Email Second", FIXTURE_TEAM.id);
  MEMBER_B2 = await approved("Email B Two", FIXTURE_OTHER_TEAM.id);
  LEAVER = await approved("Email Leaver", FIXTURE_TEAM.id);
  as(null);
});

afterEach(() => {
  __resetEvents();
  as(null);
});

// ---------------------------------------------------------------------------------------------
describe("who is emailed, and for what (AC-1 to AC-5)", () => {
  it("AC-1: an own-team event emails every other approved teammate, and nobody on another team", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "team" });
    const sent = mailFor(id);

    expect(sent.every((e) => e.kind === "event_created")).toBe(true);
    const to = sent.map((e) => e.to);
    for (const who of [MEMBER_A2, FIXTURE_ADMIN.id]) expect(to).toContain(await emailOf(who));
    for (const who of [FIXTURE_OTHER_TEAM_MEMBER.id, MEMBER_B2]) expect(to).not.toContain(await emailOf(who));
    // The creator is the actor.
    expect(to).not.toContain(await emailOf(FIXTURE_MEMBER.id));
  });

  it("AC-1: an every-team event emails nobody, while its in-app rows are written as before", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "public" });
    expect(mailFor(id)).toEqual([]);
    as(MEMBER_B2);
    expect((await mock.listNotifications()).map((n) => n.kind)).toEqual(["event_created"]);
  });

  it("AC-1, AC-2: a named event sends no event_created email; the named receive event_invited", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [MEMBER_B2, MEMBER_A2] });
    const sent = mailFor(id);
    expect(sent.map((e) => e.kind)).toEqual(["event_invited", "event_invited"]);
    expect(sent.map((e) => e.to).sort()).toEqual([await emailOf(MEMBER_A2), await emailOf(MEMBER_B2)].sort());
  });

  it("AC-2: named on an edit emails the newly named only; a second save emails nobody; the actor never", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [MEMBER_A2] });
    expect(mailFor(id)).toHaveLength(1);

    await updateAs(FIXTURE_MEMBER.id, id, { scope: "named", inviteeIds: [MEMBER_A2, MEMBER_B2] });
    expect(mailFor(id).map((e) => e.to)).toEqual([await emailOf(MEMBER_A2), await emailOf(MEMBER_B2)]);

    await updateAs(FIXTURE_MEMBER.id, id, { scope: "named", inviteeIds: [MEMBER_A2, MEMBER_B2] });
    expect(mailFor(id)).toHaveLength(2);

    await updateAs(FIXTURE_MEMBER.id, id, {
      scope: "named",
      inviteeIds: [MEMBER_A2, MEMBER_B2, FIXTURE_MEMBER.id],
    });
    expect(mailFor(id).map((e) => e.to)).not.toContain(await emailOf(FIXTURE_MEMBER.id));
  });

  it("AC-3: approved, declined and removed each email the person; a creator deciding their own receives nothing", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "public", requiresApproval: true });
    await joinAs(MEMBER_A2, id);
    await joinAs(MEMBER_B2, id);
    await decideAs(FIXTURE_MEMBER.id, id, MEMBER_A2, "attending");
    await decideAs(FIXTURE_ADMIN.id, id, MEMBER_B2, "rejected");
    await decideAs(FIXTURE_ADMIN.id, id, MEMBER_A2, "removed");

    expect(mailFor(id).map((e) => [e.kind, e.to])).toEqual([
      ["attendance_approved", await emailOf(MEMBER_A2)],
      ["attendance_rejected", await emailOf(MEMBER_B2)],
      ["attendance_removed", await emailOf(MEMBER_A2)],
    ]);

    await joinAs(FIXTURE_MEMBER.id, id);
    await decideAs(FIXTURE_MEMBER.id, id, FIXTURE_MEMBER.id, "attending");
    expect(mailFor(id)).toHaveLength(3);
  });

  it("AC-3: a person who can no longer read the event receives nothing", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, {
      scope: "named",
      requiresApproval: true,
      inviteeIds: [MEMBER_B2],
    });
    await joinAs(MEMBER_B2, id);
    await updateAs(FIXTURE_MEMBER.id, id, { scope: "named", requiresApproval: true, inviteeIds: [] });
    await decideAs(FIXTURE_MEMBER.id, id, MEMBER_B2, "rejected");
    expect(mailFor(id).map((e) => e.kind)).toEqual(["event_invited"]);
  });

  it("AC-4: an edit, a deletion, a request, a withdrawal and a cancelled request email nobody", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "public", requiresApproval: true });
    await joinAs(MEMBER_A2, id); // request
    await decideAs(FIXTURE_MEMBER.id, id, MEMBER_A2, "attending");
    const before = __sentEventEmails().length; // the approval

    await joinAs(MEMBER_B2, id); // request
    as(MEMBER_B2);
    expect((await mock.leaveEvent(id)).ok).toBe(true); // cancels the request
    as(MEMBER_A2);
    expect((await mock.leaveEvent(id)).ok).toBe(true); // withdrawal
    await joinAs(MEMBER_A2, id);
    await updateAs(FIXTURE_MEMBER.id, id, { scope: "public", requiresApproval: true, name: "Renamed" });
    as(FIXTURE_MEMBER.id);
    expect((await mock.deleteEvent(id)).ok).toBe(true);

    expect(__sentEventEmails()).toHaveLength(before);
    // And the in-app rows for them were still written.
    as(FIXTURE_MEMBER.id);
    const kinds = (await mock.listNotifications()).map((n) => n.kind);
    expect(kinds).toEqual(expect.arrayContaining(["attendance_requested", "attendance_withdrawn"]));
  });

  it("AC-5: exactly one email per email-kind notification, to that notification's recipient", async () => {
    const team = await createAs(FIXTURE_MEMBER.id, { scope: "team" });
    const named = await createAs(FIXTURE_ADMIN.id, { scope: "named", inviteeIds: [MEMBER_A2, MEMBER_B2] });
    const sent = [...mailFor(team), ...mailFor(named)];

    // Every approved person on either team, read as a member of each.
    const people = new Map<string, string>();
    for (const reader of [FIXTURE_ADMIN.id, MEMBER_B2]) {
      as(reader);
      for (const m of await mock.listMembers()) if (m.email) people.set(m.id, m.email);
    }
    const notifications = new Map<string, { kind: NotificationKind; to: string }>();
    for (const [id, email] of people) {
      as(id);
      for (const n of await mock.listNotifications()) notifications.set(n.id, { kind: n.kind, to: email });
    }
    expect(sent.length).toBeGreaterThan(0);
    expect(new Set(sent.map((e) => e.notificationId)).size).toBe(sent.length);
    for (const email of sent) {
      expect(notifications.get(email.notificationId)).toEqual({ kind: email.kind, to: email.to });
    }
  });

  it("AC-5: nothing for a write with no signed-in person", async () => {
    as(null);
    const result = await mock.createEvent(input());
    expect(result.ok).toBe(false);
    expect(__sentEventEmails()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
describe("the switch (AC-6, AC-7, AC-15)", () => {
  it("AC-7: on for an existing member and for a newly admitted one", async () => {
    as(FIXTURE_MEMBER.id);
    expect(await mock.getEventEmailEnabled()).toBe(true);
    const fresh = await approved("Email Fresh", FIXTURE_TEAM.id);
    as(fresh);
    expect(await mock.getEventEmailEnabled()).toBe(true);
    as(null);
    expect(await mock.getEventEmailEnabled()).toBeNull();
  });

  it("AC-6: off stops every kind of email for that person and nobody else; in-app is unchanged", async () => {
    await switchAs(MEMBER_A2, false);

    const team = await createAs(FIXTURE_MEMBER.id, { scope: "team" });
    const named = await createAs(FIXTURE_MEMBER.id, { scope: "named", requiresApproval: true, inviteeIds: [MEMBER_A2] });
    await joinAs(MEMBER_A2, named);
    await decideAs(FIXTURE_MEMBER.id, named, MEMBER_A2, "attending");

    const off = await emailOf(MEMBER_A2);
    expect(__sentEventEmails().map((e) => e.to)).not.toContain(off);
    expect(mailFor(team).map((e) => e.to)).toContain(await emailOf(FIXTURE_ADMIN.id));

    as(MEMBER_A2);
    expect((await mock.listNotifications()).map((n) => n.kind).sort()).toEqual(
      ["attendance_approved", "event_created", "event_invited"].sort(),
    );
  });

  it("AC-6: turning it back on affects only what is written afterwards; nothing missed is sent", async () => {
    await switchAs(MEMBER_A2, false);
    const missed = await createAs(FIXTURE_MEMBER.id, { scope: "team" });
    await switchAs(MEMBER_A2, true);
    const after = await createAs(FIXTURE_MEMBER.id, { scope: "team" });
    const to = await emailOf(MEMBER_A2);
    expect(mailFor(missed).map((e) => e.to)).not.toContain(to);
    expect(mailFor(after).map((e) => e.to)).toContain(to);
  });

  it("AC-14, AC-15: the setter writes the caller's own switch and returns it; there is no way to name anybody else", async () => {
    as(FIXTURE_ADMIN.id);
    expect(await mock.setEventEmailEnabled(false)).toEqual({ ok: true, value: false });
    expect(await mock.getEventEmailEnabled()).toBe(false);
    as(FIXTURE_MEMBER.id);
    expect(await mock.getEventEmailEnabled()).toBe(true);
    // Arity is the contract: one argument, the value.
    expect(mock.setEventEmailEnabled.length).toBe(1);
  });

  it("AC-15: a removed member cannot change theirs, and nobody signed in cannot either", async () => {
    as(FIXTURE_ADMIN.id);
    expect((await mock.removeMember(LEAVER)).ok).toBe(true);
    as(LEAVER);
    expect(await mock.setEventEmailEnabled(false)).toEqual({
      ok: false,
      error: { code: "unknown", message: "Your email setting could not be saved." },
    });
    as(null);
    expect((await mock.setEventEmailEnabled(false)).ok).toBe(false);
  });

  it("AC-16: listMembers returns the same people with the same fields across a switch change and a fan-out", async () => {
    as(FIXTURE_ADMIN.id);
    const before = await mock.listMembers();
    await switchAs(MEMBER_A2, false);
    await createAs(FIXTURE_MEMBER.id, { scope: "team" });
    as(FIXTURE_ADMIN.id);
    expect(await mock.listMembers()).toEqual(before);
    await switchAs(MEMBER_A2, true);
  });
});

// ---------------------------------------------------------------------------------------------
const request = (overrides: Partial<EventEmailRequest> = {}): EventEmailRequest => ({
  notificationId: "nf000000-0000-4000-8000-000000000001",
  kind: "event_created",
  to: "anh@example.com",
  recipientName: "Ánh",
  actorName: "Minh",
  event: {
    id: "ec000000-0000-4000-8000-000000000001",
    name: "Team lunch",
    startDate: "2026-10-12",
    endDate: "2026-10-12",
    location: "Rooftop",
  },
  ...overrides,
});

const APP = "https://calechip.example";

describe("what the email says (AC-8 to AC-11)", () => {
  it("AC-8, AC-9: each kind's subject and headline are the § 4.4 words, and the headline is the EVT-04 sentence", () => {
    const subjects: Record<EventEmailKind, string> = {
      event_created: "Minh announced Team lunch",
      event_invited: "Minh invited you to Team lunch",
      attendance_approved: "Your request to join Team lunch was approved",
      attendance_rejected: "Your request to join Team lunch was declined",
      attendance_removed: "You were removed from Team lunch",
    };
    for (const kind of EMAIL_KINDS) {
      const out = renderEventEmail(request({ kind }), APP);
      expect(out.subject).toBe(subjects[kind]);
      expect(out.text).toContain(`${subjects[kind]}.`);
      expect(out.html).toContain(`${subjects[kind]}.`);
      expect(notificationSentence(kind, "Minh", "Team lunch")).toBe(`${subjects[kind]}.`);
    }
  });

  it("AC-9: the greeting, the event, the button to the event and the footer to the profile — in both bodies", () => {
    const out = renderEventEmail(request(), APP);
    for (const body of [out.html, out.text]) {
      expect(body).toContain("Hi Ánh,");
      expect(body).toContain("Team lunch");
      expect(body).toContain("12 Oct 2026");
      expect(body).toContain("Rooftop");
      expect(body).toContain(`${APP}/events/ec000000-0000-4000-8000-000000000001`);
      expect(body).toContain(`${APP}/profile`);
    }
    expect(out.html).toContain(">View event &#8250;</a>");
    expect(out.html).toContain(
      'You got this email because you are on CaleChip. Event email can be turned off on your <a href="https://calechip.example/profile"',
    );
    expect(out.text).toContain("View event: https://calechip.example/events/");
    expect(out.text).toContain("Turn event email off: https://calechip.example/profile");
  });

  it("AC-9: no location, no location line", () => {
    const out = renderEventEmail(request({ event: { ...request().event, location: null } }), APP);
    expect(out.html).not.toContain("&#128205;");
    expect(out.text.split("\n")).not.toContain("Rooftop");
  });

  it("§ 2b: table layout with inline styles, no style block, one image — the logo — never Quicksand", () => {
    const { html } = renderEventEmail(request(), APP);
    expect(html).toContain('role="presentation"');
    expect(html).not.toMatch(/<style/i);
    expect(html.match(/<img/gi)).toHaveLength(1);
    expect(html).toContain('<img src="https://calechip.example/logo.png?v=2" width="32" height="32" alt="CaleChip"');
    expect(html).not.toMatch(/quicksand/i);
    expect(html).toContain("'Nunito', 'Baloo 2'");
  });

  it("AC-10: Vietnamese diacritics survive in the subject and both bodies", () => {
    const out = renderEventEmail(
      request({
        kind: "event_invited",
        actorName: "Nguyễn Thị Ánh",
        recipientName: "Trần Đức",
        event: { ...request().event, name: "Buổi họp Đà Nẵng", location: "Đà Nẵng" },
      }),
      APP,
    );
    expect(out.subject).toBe("Nguyễn Thị Ánh invited you to Buổi họp Đà Nẵng");
    for (const body of [out.html, out.text]) {
      expect(body).toContain("Buổi họp Đà Nẵng");
      expect(body).toContain("Hi Trần Đức,");
      expect(body).toContain("Nguyễn Thị Ánh invited you to Buổi họp Đà Nẵng.");
    }
  });

  it("AC-10: markup is shown as characters in the HTML and left as written in the subject and text", () => {
    const out = renderEventEmail(
      request({
        actorName: `<script>alert("x")</script>`,
        recipientName: "<b>x</b>",
        event: { ...request().event, name: "Tom & Jerry's <b>x</b>", location: "<i>here</i>" },
      }),
      APP,
    );
    expect(out.html).not.toContain("<script>");
    expect(out.html).not.toContain("<b>x</b>");
    expect(out.html).not.toContain("<i>here</i>");
    expect(out.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(out.html).toContain("Tom &amp; Jerry&#39;s &lt;b&gt;x&lt;/b&gt;");
    expect(out.html).toContain("Hi &lt;b&gt;x&lt;/b&gt;,");
    expect(out.subject).toBe(`<script>alert("x")</script> announced Tom & Jerry's <b>x</b>`);
    expect(out.text).toContain("<i>here</i>");
  });

  it("SOLO 2026-10-09: each kind has its own badge, intro and button; the subject and headline are unchanged", () => {
    const expected: Record<EventEmailKind, [string, string, string]> = {
      event_created: ["New event", "There's a new event on the team calendar.", "View event"],
      event_invited: ["Invitation", "Save the date — we'd love to have you there.", "View & join"],
      attendance_approved: ["Approved ★", "You're on the list. See you there!", "View event"],
      attendance_rejected: ["Declined", "The organiser couldn't fit you in this time.", "View event"],
      attendance_removed: ["Removed", "You're no longer on the list for this event.", "View event"],
    };
    for (const kind of EMAIL_KINDS) {
      const [badge, intro, button] = expected[kind];
      const out = renderEventEmail(request({ kind }), APP);
      expect(out.html).toContain(`&#9993; ${badge}</td>`);
      expect(out.html).toContain(intro.replace(/'/g, "&#39;").replace(/&(?!#)/g, "&amp;"));
      expect(out.html).toContain(`>${button.replace(/&/g, "&amp;")} &#8250;</a>`);
      expect(out.text).toContain(intro);
      expect(out.text).toContain(`${button}: ${APP}/events/`);
    }
  });

  it("SOLO 2026-10-09: the header, the weekday line, and a footer of MMLabs, CaleChip and an unlinked Contact", () => {
    const out = renderEventEmail(request(), APP);
    expect(out.html).toContain(">CaleChip</div>");
    expect(out.html).toContain(">TEAM CALENDAR</div>");
    expect(out.html).toContain(">Monday</div>");
    expect(out.text).toContain("12 Oct 2026 (Monday)");
    expect(out.html).toContain('<a href="https://mmlabs.online"');
    expect(out.html).toContain(`<a href="${APP}" style="color:#9A93B8;text-decoration:none;">CaleChip</a>`);
    expect(out.html).toContain('<span style="color:#9A93B8;">Contact</span>');
    expect(out.html).not.toMatch(/<a [^>]*>Contact<\/a>/);
    expect(out.html).not.toMatch(/&#127880;|&#127882;/); // no balloon, no confetti
  });

  it("SOLO 2026-10-09: weekdays for one day, a range, and nothing for a date that does not parse", () => {
    expect(formatEventWeekdays("2026-10-12", "2026-10-12")).toBe("Monday");
    expect(formatEventWeekdays("2026-10-12", "2026-10-14")).toBe("Mon – Wed");
    expect(formatEventWeekdays("2026-12-30", "2027-01-02")).toBe("Wed – Sat");
    expect(formatEventWeekdays("2026-02-30", "2026-03-01")).toBe("");
  });

  it("AC-11: one day, a range within a month, across months, across years", () => {
    expect(formatEventDates("2026-10-12", "2026-10-12")).toBe("12 Oct 2026");
    expect(formatEventDates("2026-10-12", "2026-10-14")).toBe("12–14 Oct 2026");
    expect(formatEventDates("2026-10-30", "2026-11-02")).toBe("30 Oct – 2 Nov 2026");
    expect(formatEventDates("2026-12-30", "2027-01-02")).toBe("30 Dec 2026 – 2 Jan 2027");
  });
});

// ---------------------------------------------------------------------------------------------
describe("the sender answers only the database (AC-13)", () => {
  it("accepts exactly the § 4.3 body", () => {
    expect(parseEventEmailRequest(JSON.parse(JSON.stringify(request())))).toEqual(request());
    const noLocation = { ...request(), event: { ...request().event, location: null } };
    expect(parseEventEmailRequest(noLocation)).toEqual(noLocation);
    for (const kind of EMAIL_KINDS) expect(parseEventEmailRequest(request({ kind }))).not.toBeNull();
  });

  it("refuses each malformed field", () => {
    const base = request();
    const bad: unknown[] = [
      null,
      "a string",
      [],
      { ...base, notificationId: "" },
      { ...base, notificationId: 7 },
      { ...base, kind: "event_updated" },
      { ...base, kind: "event_cancelled" },
      { ...base, kind: "attendance_requested" },
      { ...base, kind: "attendance_withdrawn" },
      { ...base, to: "" },
      { ...base, to: undefined },
      { ...base, recipientName: "  " },
      { ...base, actorName: null },
      { ...base, event: null },
      { ...base, event: { ...base.event, id: "" } },
      { ...base, event: { ...base.event, name: "" } },
      { ...base, event: { ...base.event, startDate: "12/10/2026" } },
      { ...base, event: { ...base.event, endDate: "2026-02-30" } },
      { ...base, event: { ...base.event, startDate: "2026-10-13", endDate: "2026-10-12" } },
      { ...base, event: { ...base.event, location: 5 } },
      { ...base, event: { ...base.event, location: undefined } },
    ];
    for (const value of bad) expect(parseEventEmailRequest(value)).toBeNull();
  });

  it("checks the secret before the environment and the body, in constant time, and logs no address or secret", () => {
    const secret = SENDER.indexOf("x-event-email-secret");
    const envLoop = SENDER.indexOf("for (const name of REQUIRED_ENV)");
    const parse = SENDER.indexOf("parseEventEmailRequest(body)");
    expect(secret).toBeGreaterThan(0);
    expect(secret).toBeLessThan(envLoop);
    expect(envLoop).toBeLessThan(parse);
    expect(SENDER).toMatch(/return json\(401/);
    expect(SENDER).toMatch(/return json\(405/);
    expect(SENDER).toMatch(/return json\(400/);
    expect(SENDER).toMatch(/return json\(502/);
    expect(SENDER).toContain("constantTimeEqual(presented, expected)");
    for (const line of SENDER.split("\n").filter((l) => l.includes("console.error"))) {
      expect(line).not.toMatch(/SMTP_PASS|EMAIL_HOOK_SECRET|parsed\.to|rendered\./);
    }
    // ADR-053 decision 2: no database client and no service key.
    expect(SENDER).not.toMatch(/supabase-js|SERVICE_ROLE|createClient/);
    // Sent to the request's `to` alone, from MAIL_FROM.
    expect(SENDER).toMatch(/from: env\.MAIL_FROM,\s*to: parsed\.to,/);
  });

  it("no file under src/ names the sender or calls it (ADR-051 decision 3)", () => {
    const root = fileURLToPath(new URL("../src", import.meta.url));
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (readFileSync(path, "utf8").includes("send-event-email")) offenders.push(path);
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
describe("the migration (AC-1 to AC-7, AC-12, AC-15, AC-16)", () => {
  it("the trigger fires after insert on notification for exactly the five kinds", () => {
    const trigger = SQL.match(/create trigger email_notification[\s\S]*?;/);
    expect(trigger).not.toBeNull();
    const text = trigger![0];
    expect(text).toMatch(/after insert on public\.notification/);
    expect(text).toMatch(/for each row/);
    const listed = [...text.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(listed).toEqual([...EMAIL_KINDS].sort());
    expect(SQL).toMatch(/drop trigger if exists email_notification on public\.notification;/);
  });

  it("the trigger checks the switch, the address and own-team scope, reads Vault, posts through pg_net", () => {
    const body = functionBody("email_notification");
    expect(body).toMatch(/security definer set search_path = ''/);
    expect(body).toMatch(/r\.event_email_enabled/);
    expect(body).toMatch(/u\.email is not null/);
    expect(body).toMatch(/e\.scope = 'team'::public\.event_scope/);
    expect(body).toMatch(/new\.kind <> 'event_created'::public\.notification_kind/);
    expect(body).toMatch(/join auth\.users u\s+on u\.id = new\.recipient_id/);
    expect(body).toMatch(/vault\.decrypted_secrets/);
    expect(body).toContain("'event_email_function_url'");
    expect(body).toContain("'event_email_hook_secret'");
    expect(body).toMatch(/net\.http_post\(/);
    expect(body).toContain("'x-event-email-secret'");
    for (const key of ["notificationId", "kind", "to", "recipientName", "actorName", "event", "id", "name", "startDate", "endDate", "location"]) {
      expect(body).toContain(`'${key}'`);
    }
  });

  it("AC-12: the whole body is inside `exception when others`, and it returns new", () => {
    const body = functionBody("email_notification");
    expect(body).toMatch(/exception when others then\s+raise warning 'event email not queued for notification %: %', new\.id, sqlerrm;/);
    expect(body).toMatch(/end;\s+return new;\s+end;\s+\$\$;$/);
    // Everything that can fail sits between the inner `begin` and the handler.
    const inner = body.indexOf("begin\n  begin");
    expect(inner).toBeGreaterThan(0);
    expect(body.indexOf("vault.decrypted_secrets")).toBeGreaterThan(inner);
    expect(body.indexOf("net.http_post")).toBeLessThan(body.indexOf("exception when others"));
  });

  it("AC-7, AC-15: the column defaults on, set_event_email writes only the caller's live row, and no update grant names it", () => {
    expect(SQL).toMatch(/create extension if not exists pg_net;/);
    expect(SQL).toMatch(
      /alter table public\.member\s+add column if not exists event_email_enabled boolean not null default true;/,
    );
    const rpc = functionBody("set_event_email");
    expect(rpc).toMatch(/\(p_enabled boolean\) returns boolean/);
    expect(rpc).toMatch(/security definer set search_path = ''/);
    expect(rpc).toMatch(/where id = \(select auth\.uid\(\)\)\s+and removed_at is null/);
    expect(rpc).toMatch(/set event_email_enabled = p_enabled\s+where/);
    expect(SQL).not.toMatch(/grant update[^;]*event_email_enabled/);
    expect(SQL).toMatch(/revoke all on function public\.set_event_email\(boolean\) from public, anon;/);
    expect(SQL).toMatch(/grant execute on function public\.set_event_email\(boolean\) to authenticated;/);
    expect(SQL).toMatch(/revoke all on function public\.email_notification\(\) from public, anon;/);
  });

  it("AC-16: no member policy and no EVT-04 function is touched", () => {
    expect(SQL).not.toMatch(/(create|drop|alter) policy[^;]*on public\.member/);
    for (const name of ["notify", "may_read_event", "mark_notifications_read", "member_enforce_role_and_removal"]) {
      expect(SQL).not.toMatch(new RegExp(`function public\\.${name}\\(`));
    }
    expect(SQL).not.toMatch(/function public\.notify_/);
    expect(SQL).not.toMatch(/trigger notify_/);
    // EVT-04's file is still the only writer of notification rows.
    expect(EVT04).toMatch(/create or replace function public\.notify\(/);
    expect(SQL).not.toMatch(/insert into public\.notification/);
  });

  it("is one transaction", () => {
    expect(SQL.trim().startsWith("begin;")).toBe(true);
    expect(SQL.trim().endsWith("commit;")).toBe(true);
  });
});
