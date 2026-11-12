// MIR-19-e AC-1 to AC-6 — a member's event email links into their org (01-plan.md § 4.5). The parser
// and the renderer are the pure template; the migration is checked by reading it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseEventEmailRequest,
  parseInvitationEmailRequest,
  renderEventEmail,
  renderInvitationEmail,
  type EventEmailKind,
  type EventEmailRequest,
  type InvitationEmailRequest,
} from "../supabase/functions/send-event-email/template";

const APP = "https://calechip.example";
const EVENT_ID = "ec000000-0000-4000-8000-000000000001";
const TOKEN = "ab".repeat(32);
const KINDS: EventEmailKind[] = [
  "event_created",
  "event_invited",
  "attendance_approved",
  "attendance_rejected",
  "attendance_removed",
];

const EVENT = {
  id: EVENT_ID,
  name: "Team picnic",
  startDate: "2026-11-20",
  endDate: "2026-11-20",
  location: null,
};

const eventRequest = (extra: Record<string, unknown> = {}, kind: EventEmailKind = "event_invited") => ({
  notificationId: "n-1",
  kind,
  to: "an@example.test",
  recipientName: "An",
  actorName: "Binh",
  event: EVENT,
  ...extra,
});

const memberInvite = (extra: Record<string, unknown> = {}) => ({
  invitationId: "i-1",
  kind: "invitation_member",
  to: "an@example.test",
  inviterName: "Binh",
  recipientName: "An",
  event: EVENT,
  guestToken: null,
  ...extra,
});

const guestInvite = (extra: Record<string, unknown> = {}) => ({
  invitationId: "i-2",
  kind: "invitation_guest",
  to: "guest@example.test",
  inviterName: "Binh",
  recipientName: null,
  event: EVENT,
  guestToken: TOKEN,
  ...extra,
});

const BAD_ORG_CODES: unknown[] = [
  123,
  "",
  "Shared",
  "-ab",
  "ab-",
  "a".repeat(33),
  "shared/x",
  "../x",
  "shared x",
  true,
  {},
];

function parsedEvent(extra: Record<string, unknown> = {}, kind?: EventEmailKind): EventEmailRequest {
  const parsed = parseEventEmailRequest(eventRequest(extra, kind));
  if (!parsed) throw new Error("request refused");
  return parsed;
}

function parsedInvite(input: Record<string, unknown>): InvitationEmailRequest {
  const parsed = parseInvitationEmailRequest(input);
  if (!parsed) throw new Error("request refused");
  return parsed;
}

describe("MIR-19-e AC-1: a member's event email links into their org", () => {
  for (const kind of KINDS) {
    it(`AC-1: ${kind}`, () => {
      const out = renderEventEmail(parsedEvent({ orgCode: "shared" }, kind), APP);
      for (const body of [out.html, out.text]) {
        expect(body).toContain(`${APP}/shared/events/${EVENT_ID}`);
        expect(body).toContain(`${APP}/shared/profile`);
        expect(body).not.toContain(`${APP}/events/`);
        expect(body).not.toContain(`${APP}/profile`);
      }
      expect(out.html).toContain(`${APP}/logo.png?v=2`);
      expect(out.html).toContain(`<a href="${APP}" `);
      expect(out.text).toContain(`CaleChip: ${APP}`);
    });
  }
});

describe("MIR-19-e AC-2: a request without an org code renders as before", () => {
  it("AC-2: absent and null render alike, with root links", () => {
    const absent = renderEventEmail(parsedEvent(), APP);
    const nulled = renderEventEmail(parsedEvent({ orgCode: null }), APP);
    expect(nulled.subject).toBe(absent.subject);
    expect(nulled.html).toBe(absent.html);
    expect(nulled.text).toBe(absent.text);
    for (const body of [absent.html, absent.text]) {
      expect(body).toContain(`${APP}/events/${EVENT_ID}`);
      expect(body).toContain(`${APP}/profile`);
    }
  });
});

describe("MIR-19-e AC-3: the parser accepts an org code in the database's shape", () => {
  it("AC-3: absent, null and shaped strings", () => {
    expect("orgCode" in parsedEvent()).toBe(false);
    expect(parsedEvent({ orgCode: null }).orgCode).toBeNull();
    expect(parsedEvent({ orgCode: "shared" }).orgCode).toBe("shared");
    expect(parsedEvent({ orgCode: "a1-b2" }).orgCode).toBe("a1-b2");
  });

  it("AC-3: anything else is refused", () => {
    for (const bad of BAD_ORG_CODES) {
      expect(parseEventEmailRequest(eventRequest({ orgCode: bad })), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("MIR-19-e AC-4: a member's invitation links into their org", () => {
  it("AC-4: equals the event_invited rendering with the org code", () => {
    const invite = parsedInvite(memberInvite({ orgCode: "shared" }));
    const out = renderInvitationEmail(invite, APP);
    const expected = renderEventEmail(
      {
        notificationId: invite.invitationId,
        kind: "event_invited",
        to: invite.to,
        recipientName: invite.recipientName ?? "",
        actorName: invite.inviterName,
        orgCode: "shared",
        event: invite.event,
      },
      APP,
    );
    expect(out).toEqual(expected);
    for (const body of [out.html, out.text]) {
      expect(body).toContain(`${APP}/shared/events/${EVENT_ID}`);
      expect(body).toContain(`${APP}/shared/profile`);
    }
  });

  it("AC-4: the parser takes absent, null or a shaped string, and refuses the rest", () => {
    expect(parseInvitationEmailRequest(memberInvite())).not.toBeNull();
    expect(parseInvitationEmailRequest(memberInvite({ orgCode: null }))).not.toBeNull();
    expect(parseInvitationEmailRequest(memberInvite({ orgCode: "shared" }))).not.toBeNull();
    for (const bad of BAD_ORG_CODES) {
      expect(parseInvitationEmailRequest(memberInvite({ orgCode: bad })), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("MIR-19-e AC-5: a guest's invitation carries no org", () => {
  it("AC-5: accepted with orgCode absent or null, refused with a string", () => {
    expect(parseInvitationEmailRequest(guestInvite())).not.toBeNull();
    expect(parseInvitationEmailRequest(guestInvite({ orgCode: null }))).not.toBeNull();
    expect(parseInvitationEmailRequest(guestInvite({ orgCode: "shared" }))).toBeNull();
  });

  it("AC-5: the button is the token-only link and neither body names an org", () => {
    const out = renderInvitationEmail(parsedInvite(guestInvite({ orgCode: null })), APP);
    expect(out.html).toContain(`${APP}/guest/${TOKEN}`);
    expect(out.text).toContain(`${APP}/guest/${TOKEN}`);
    expect(out.html).not.toContain("/shared/");
    expect(out.text).not.toContain("/shared/");
  });
});

describe("MIR-19-e AC-6: the migration puts the recipient's org code in each request", () => {
  const read = (name: string): string =>
    readFileSync(fileURLToPath(new URL(`../supabase/migrations/${name}`, import.meta.url)), "utf8");
  const NEW = read("20261112090000_mir19e_email_org_code.sql");
  const strip = (sql: string): string => sql.replace(/--[^\n]*/g, "");
  const body = (sql: string, name: string): string => {
    const match = strip(sql).match(
      new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`),
    );
    if (!match) throw new Error(`no function ${name}`);
    return match[0];
  };
  const normalise = (text: string): string =>
    text
      .split("\n")
      .filter((line) => !/org/.test(line))
      .join("\n")
      .replace(/\s+/g, " ")
      .trim();

  it("AC-6: one transaction, two functions, nothing else", () => {
    const sql = strip(NEW);
    expect(sql.trim().startsWith("begin;")).toBe(true);
    expect(sql.trim().endsWith("commit;")).toBe(true);
    expect(sql.match(/create or replace function/g)).toHaveLength(2);
    for (const word of [
      "create trigger",
      "drop trigger",
      "create policy",
      "alter policy",
      "drop policy",
      "alter table",
      "create table",
      "grant select",
      "grant insert",
      "grant update",
      "grant delete",
      "drop function",
    ]) {
      expect(sql, word).not.toContain(word);
    }
  });

  it("AC-6: email_notification carries the recipient's org code through a left join", () => {
    const fn = body(NEW, "email_notification").replace(/[ \t]+/g, " ");
    expect(fn).toContain("'orgCode', o.org_code");
    expect(fn).toMatch(
      /left join public\.org o on o\.id = public\.member_org_id\(r\.id\)/,
    );
  });

  it("AC-6: email_invitation carries it in the member branch and null in the guest branch", () => {
    const fn = body(NEW, "email_invitation").replace(/\s+/g, " ");
    expect(fn).toContain(
      "'orgCode', (select o.org_code from public.org o where o.id = public.member_org_id(v_member_id))",
    );
    expect(fn).toContain("'orgCode', null::text");
  });

  it("AC-6: apart from the lines naming org, each body is the previous definition's", () => {
    const pairs: Array<[string, string]> = [
      ["email_notification", "20261009090000_evt05_event_email.sql"],
      ["email_invitation", "20261014090000_evt12_invite_every_scope.sql"],
    ];
    for (const [name, previous] of pairs) {
      expect(normalise(body(NEW, name)), name).toBe(normalise(body(read(previous), name)));
    }
  });

  it("AC-6: the file ends with the four grant lines, then commit", () => {
    const tail = strip(NEW)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
    expect(tail.slice(-5)).toEqual([
      "revoke all on function public.email_notification() from public, anon;",
      "grant execute on function public.email_notification() to authenticated;",
      "revoke all on function public.email_invitation() from public, anon;",
      "grant execute on function public.email_invitation() to authenticated;",
      "commit;",
    ]);
  });
});
