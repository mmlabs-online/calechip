// EVT-09 — inviting by email while creating a public event; EVT-12 — any scope. 01-plan.md § 2 AC-2..AC-6, AC-8; § 4.
//
// `createEventWithInvitations` is the whole of the form's new behaviour, and it takes a
// `Pick<DataSeam, …>` precisely so the order of the two calls can be asserted without a browser:
// a recording stub for the order and the refusals, the mock seam for what actually lands.
// `readInviteHandoff` is asserted on the untyped input history state really is.
//
// **EVERY RULE OF AN INVITATION IS EVT-08's** and is asserted in `tests/event-invitation.test.ts`,
// untouched. What is asserted here is that this surface reaches it, in order, or not at all.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { DataSeam, SaveEventInput } from "@/lib/data";
import type { CalEvent, EmailInvitationOutcome, Failure, Result } from "@/lib/domain/types";
import {
  seam as mock,
  __resetEvents,
  __sentInvitationEmails,
  __setCurrentMember,
} from "@/lib/data/mock";
import { createEventWithInvitations } from "@/routes/EventEditor";
import { readInviteHandoff } from "@/routes/EventDetail";
import { FIXTURE_APPROVED_MEMBER, FIXTURE_MEMBER } from "@/lib/fixtures";

const INVALID_SENTENCE = "Each address must look like name@example.com, in 254 characters or fewer.";

const input = (overrides: Partial<SaveEventInput> = {}): SaveEventInput => ({
  name: "Tiệc cuối năm",
  description: null,
  location: null,
  startDate: "2099-03-10",
  endDate: "2099-03-10",
  scope: "public",
  inviteeIds: [],
  ...overrides,
});

type Call = { fn: "createEvent"; input: SaveEventInput } | { fn: "inviteToEvent"; eventId: string; emails: string[] };

/** A recording stub. `create` and `invite` decide each answer; every call is kept, in order. */
function stub(options: {
  create?: () => Result<CalEvent>;
  invite?: (emails: string[]) => Promise<Result<EmailInvitationOutcome[]>>;
} = {}): { data: Pick<DataSeam, "createEvent" | "inviteToEvent">; calls: Call[] } {
  const calls: Call[] = [];
  const data: Pick<DataSeam, "createEvent" | "inviteToEvent"> = {
    createEvent: (i) => {
      calls.push({ fn: "createEvent", input: i });
      return Promise.resolve(options.create ? options.create() : { ok: true, value: { id: "evt-1" } as CalEvent });
    },
    inviteToEvent: (eventId, emails) => {
      calls.push({ fn: "inviteToEvent", eventId, emails });
      return options.invite
        ? options.invite(emails)
        : Promise.resolve({ ok: true, value: emails.map((email) => ({ email, outcome: "sent" as const })) });
    },
  };
  return { data, calls };
}

const refusal = (code: Failure["code"], message: string): { ok: false; error: Failure } => ({
  ok: false,
  error: { code, message },
});

afterEach(() => {
  __resetEvents();
  __setCurrentMember(null);
});

describe("EVT-09 AC-2 — no addresses is EVT-01's creation, unchanged", () => {
  it.each([
    ["empty", ""],
    ["only spaces and separators", "  ,; \n\t ;, "],
  ])("AC-2: a public event with the field %s — createEvent only, no handoff", async (_label, text) => {
    const { data, calls } = stub();
    const result = await createEventWithInvitations(data, input(), text);
    expect(result).toEqual({ ok: true, id: "evt-1", handoff: null });
    expect(calls.map((c) => c.fn)).toEqual(["createEvent"]);
  });

});

// EVT-09 AC-2's "a scope other than public … whatever the field held" is replaced by EVT-12 AC-2:
// the field is drawn and sent for every scope.
describe("EVT-12 AC-2 — the field on the create form for every scope", () => {
  it.each(["team", "named"] as const)("a %s event with addresses is created, then invited", async (scope) => {
    const { data, calls } = stub();
    const result = await createEventWithInvitations(data, input({ scope }), "friend@outside.example");
    expect(calls).toEqual([
      { fn: "createEvent", input: input({ scope }) },
      { fn: "inviteToEvent", eventId: "evt-1", emails: ["friend@outside.example"] },
    ]);
    expect(result).toMatchObject({ ok: true, id: "evt-1", handoff: { kind: "invited" } });
  });

  it("a team event with a malformed address creates nothing", async () => {
    const { data, calls } = stub();
    const result = await createEventWithInvitations(data, input({ scope: "team" }), "not-an-address");
    expect(result).toEqual({ ok: false, malformed: ["not-an-address"] });
    expect(calls).toEqual([]);
  });

  it("through the mock seam, a team event's outsider is handed to the sender with the guest link", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);
    const result = await createEventWithInvitations(mock, input({ scope: "team" }), "friend@outside.example");
    expect(result.ok).toBe(true);
    expect(__sentInvitationEmails()).toEqual([
      expect.objectContaining({ kind: "invitation_guest", to: "friend@outside.example" }),
    ]);
  });
});

describe("EVT-09 AC-3 — created first, then invited", () => {
  it("AC-3: createEvent, then inviteToEvent with the new id and the parsed addresses", async () => {
    const { data, calls } = stub();
    const result = await createEventWithInvitations(
      data,
      input(),
      "one@outside.example, two@outside.example;\nthree@outside.example  four@outside.example",
    );
    expect(calls).toEqual([
      { fn: "createEvent", input: input() },
      {
        fn: "inviteToEvent",
        eventId: "evt-1",
        emails: ["one@outside.example", "two@outside.example", "three@outside.example", "four@outside.example"],
      },
    ]);
    expect(result).toEqual({
      ok: true,
      id: "evt-1",
      handoff: {
        kind: "invited",
        outcomes: [
          { email: "one@outside.example", outcome: "sent" },
          { email: "two@outside.example", outcome: "sent" },
          { email: "three@outside.example", outcome: "sent" },
          { email: "four@outside.example", outcome: "sent" },
        ],
      },
    });
  });

  it("AC-3: the handoff carries inviteToEvent's outcomes unchanged", async () => {
    const outcomes: EmailInvitationOutcome[] = [
      { email: "a@outside.example", outcome: "sent" },
      { email: "b@outside.example", outcome: "ignored" },
    ];
    const { data } = stub({ invite: () => Promise.resolve({ ok: true, value: outcomes }) });
    const result = await createEventWithInvitations(data, input(), "a@outside.example b@outside.example");
    expect(result).toEqual({ ok: true, id: "evt-1", handoff: { kind: "invited", outcomes } });
  });

  it("AC-3: through the mock seam, the creator invites, a repeat in another case counts once, and the guest link opens", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);
    const result = await createEventWithInvitations(
      mock,
      input(),
      "one@outside.example ONE@outside.example two@outside.example",
    );
    if (!result.ok) throw new Error("expected creation");
    expect(result.handoff).toEqual({
      kind: "invited",
      outcomes: [
        { email: "one@outside.example", outcome: "sent" },
        { email: "two@outside.example", outcome: "sent" },
      ],
    });
    const listed = await mock.listEventEmailInvitations(result.id);
    expect(listed.map((i) => i.email).sort()).toEqual(["one@outside.example", "two@outside.example"]);
    expect(listed.every((i) => i.invitedBy === FIXTURE_MEMBER.id)).toBe(true);
    expect(await mock.getEventGuestLink(result.id)).not.toBeNull();
    expect(__sentInvitationEmails()).toHaveLength(2);
  });

  it("AC-3: a member's address and an outsider's give the same handoff shape", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);
    const result = await createEventWithInvitations(
      mock,
      input(),
      `${FIXTURE_APPROVED_MEMBER.email} stranger@outside.example`,
    );
    if (!result.ok || result.handoff?.kind !== "invited") throw new Error("expected invitations");
    const [member, outsider] = result.handoff.outcomes;
    if (member === undefined || outsider === undefined) throw new Error("expected two outcomes");
    expect(Object.keys(member).sort()).toEqual(Object.keys(outsider).sort());
    expect(member.outcome).toBe(outsider.outcome);
  });
});

describe("EVT-09 AC-4 — a malformed address creates nothing", () => {
  it.each([
    ["no at sign", "good@outside.example, not-an-address", ["not-an-address"]],
    ["no dot after the at", "bad@nowhere", ["bad@nowhere"]],
    ["over 254 characters", `${"a".repeat(250)}@x.example`, [`${"a".repeat(250)}@x.example`]],
  ])("AC-4: %s — neither call is made and the bad addresses are returned", async (_label, text, bad) => {
    const { data, calls } = stub();
    const result = await createEventWithInvitations(data, input(), text);
    expect(result).toEqual({ ok: false, malformed: bad });
    expect(calls).toEqual([]);
  });

  it("AC-4: through the mock seam, no event exists and nothing is handed to the sender", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);
    const before = (await mock.listEvents()).length;
    const result = await createEventWithInvitations(mock, input(), "good@outside.example not-an-address");
    expect(result).toEqual({ ok: false, malformed: ["not-an-address"] });
    expect((await mock.listEvents()).length).toBe(before);
    expect(__sentInvitationEmails()).toEqual([]);
  });

  it("AC-4: the form's sentence is EVT-08's, verbatim", () => {
    const editor = readFileSync(fileURLToPath(new URL("../src/routes/EventEditor.tsx", import.meta.url)), "utf8");
    expect(editor).toContain(`"${INVALID_SENTENCE}"`);
  });
});

describe("EVT-09 AC-5 — createEvent's refusals are the form's, as before", () => {
  it("AC-5: createEvent refused — its failure is returned and inviteToEvent is not called", async () => {
    const failure = refusal("unknown", "Please give the event a name.");
    const { data, calls } = stub({ create: () => failure });
    const result = await createEventWithInvitations(data, input({ name: "" }), "friend@outside.example");
    expect(result).toEqual(failure);
    expect(calls.map((c) => c.fn)).toEqual(["createEvent"]);
  });

  it("AC-5: through the mock seam, an empty name creates nothing and invites nobody", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);
    const before = (await mock.listEvents()).length;
    const result = await createEventWithInvitations(mock, input({ name: "  " }), "friend@outside.example");
    expect(result.ok).toBe(false);
    expect("error" in result).toBe(true);
    expect((await mock.listEvents()).length).toBe(before);
    expect(__sentInvitationEmails()).toEqual([]);
  });
});

describe("EVT-09 AC-6 — the event is created but the invitations fail", () => {
  it("AC-6: inviteToEvent refused — the event's id, and a failed handoff with the sentence and the addresses", async () => {
    const { data, calls } = stub({ invite: () => Promise.resolve(refusal("network", "Check your connection.")) });
    const result = await createEventWithInvitations(data, input(), "a@outside.example; b@outside.example");
    expect(result).toEqual({
      ok: true,
      id: "evt-1",
      handoff: { kind: "failed", message: "Check your connection.", emails: ["a@outside.example", "b@outside.example"] },
    });
    expect(calls.map((c) => c.fn)).toEqual(["createEvent", "inviteToEvent"]);
  });

  it("AC-6: inviteToEvent threw — still the event's id and a failed handoff", async () => {
    const { data } = stub({ invite: () => Promise.reject(new Error("socket hang up")) });
    const result = await createEventWithInvitations(data, input(), "a@outside.example");
    expect(result).toEqual({
      ok: true,
      id: "evt-1",
      handoff: { kind: "failed", message: "Something went wrong. Please try again.", emails: ["a@outside.example"] },
    });
  });
});

describe("EVT-09 AC-7 — one call to createEvent per save", () => {
  it("AC-7: createEvent is called exactly once, whatever the invitations answer", async () => {
    for (const invite of [
      () => Promise.resolve({ ok: true as const, value: [] }),
      () => Promise.resolve(refusal("unknown", "No.")),
      () => Promise.reject(new Error("boom")),
    ]) {
      const { data, calls } = stub({ invite });
      await createEventWithInvitations(data, input(), "a@outside.example");
      expect(calls.filter((c) => c.fn === "createEvent")).toHaveLength(1);
    }
  });
});

describe("EVT-09 § 4.1 — readInviteHandoff, history state as untyped input", () => {
  it("AC-3: an invited handoff is read back", () => {
    const outcomes: EmailInvitationOutcome[] = [{ email: "a@outside.example", outcome: "sent" }];
    expect(readInviteHandoff({ kind: "invited", outcomes })).toEqual({ kind: "invited", outcomes });
  });

  it("AC-6: a failed handoff is read back", () => {
    const state = { kind: "failed", message: "No.", emails: ["a@outside.example"] };
    expect(readInviteHandoff(state)).toEqual(state);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "invited"],
    ["an array", [{ kind: "invited", outcomes: [] }]],
    ["an unknown kind", { kind: "sent", outcomes: [] }],
    ["invited without outcomes", { kind: "invited" }],
    ["an outcome of another value", { kind: "invited", outcomes: [{ email: "a@x.example", outcome: "member" }] }],
    ["an outcome without an email", { kind: "invited", outcomes: [{ outcome: "sent" }] }],
    ["failed without a message", { kind: "failed", emails: [] }],
    ["failed with emails not strings", { kind: "failed", message: "No.", emails: [1] }],
  ])("AC-8: %s is null", (_label, state) => {
    expect(readInviteHandoff(state)).toBeNull();
  });

  it("AC-8: extra fields are not carried through", () => {
    const read = readInviteHandoff({
      kind: "invited",
      outcomes: [{ email: "a@outside.example", outcome: "sent", isMember: true }],
      extra: 1,
    });
    expect(read).toEqual({ kind: "invited", outcomes: [{ email: "a@outside.example", outcome: "sent" }] });
  });
});
