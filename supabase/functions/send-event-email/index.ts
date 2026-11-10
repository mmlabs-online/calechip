// EVT-05 — `send-event-email`, the product's only server-side code. 01-plan.md § 4.5. ADR-051,
// ADR-053.
//
// EVT-08 — a second request shape, the email invitation's, posted by `email_invitation()` with the
// same secret (01-plan.md § 4.4, ADR-055 decision 7). Tried after EVT-05's; nothing else changed.
//
// **IT AUTHORIZES NOTHING AND READS NOTHING** (ADR-051 decision 2, ADR-053 decision 2). It holds no
// database credential. Who is mailed was decided by `email_notification()` in
// `supabase/migrations/20261009090000_evt05_event_email.sql` before this function was called; the
// request carries everything the message needs, and this file renders it and sends it to `to` alone.
//
// **ONLY THE DATABASE CALLS IT** (ADR-051 decision 3). The caller proves itself with the shared
// secret in `x-event-email-secret`, which lives in Vault on one side and `EMAIL_HOOK_SECRET` here.
// The secret is checked FIRST, before the environment and the body, so an unauthenticated caller
// learns nothing about the configuration (AC-13). Deployed with `--no-verify-jwt` for that reason.
//
// **A FAILED SEND IS LOGGED AND DROPPED, NEVER RETRIED** (ADR-053 decision 6). The log names the
// notification id, the kind and the error — never the password, the secret, the address or the body.
//
// Gmail over SMTP on 465, implicit TLS — hosted Edge Functions refuse 25 and 587 (ADR-053 § Context).
// TODO(verify): that `nodemailer`'s `createTransport` with `secure: true` on 465 runs under Supabase's
// Edge Runtime, with one real send from the deployed function. The major is pinned in the specifier;
// 10 was the current release on the registry on 2026-10-09.
//
// Runs under Deno, not Node and not Vite: no file under `src/` imports this, and none may (AC-13).
import nodemailer from "npm:nodemailer@10";
import {
  parseEventEmailRequest,
  parseInvitationEmailRequest,
  renderEventEmail,
  renderInvitationEmail,
  type RenderedEmail,
} from "./template.ts";

const REQUIRED_ENV = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "MAIL_FROM",
  "APP_URL",
  "EMAIL_HOOK_SECRET",
] as const;

// EVT-08 § 4.4. An EVT-05 request is answered with its `notificationId`, an invitation with its
// `invitationId` instead.
type Answer = { sent: boolean; notificationId?: string; invitationId?: string; error?: string };

const json = (status: number, body: Answer): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Equal length and equal bytes, examined in full whatever the first difference — so the time taken
 *  says nothing about how much of a guess was right. */
function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return difference === 0;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return json(405, { sent: false, error: "method not allowed" });
  }

  // The secret first (AC-13). A missing EMAIL_HOOK_SECRET refuses everybody here rather than
  // answering 500, which would tell an unauthenticated caller the function is unconfigured.
  const expected = Deno.env.get("EMAIL_HOOK_SECRET") ?? "";
  const presented = request.headers.get("x-event-email-secret") ?? "";
  if (expected === "" || presented === "" || !constantTimeEqual(presented, expected)) {
    return json(401, { sent: false, error: "unauthorized" });
  }

  const env: Record<(typeof REQUIRED_ENV)[number], string> = {} as never;
  for (const name of REQUIRED_ENV) {
    const value = Deno.env.get(name);
    if (value === undefined || value === "") {
      console.error(`send-event-email: environment variable ${name} is not set`);
      return json(500, { sent: false, error: "not configured" });
    }
    env[name] = value;
  }
  const port = Number(env.SMTP_PORT);
  if (!Number.isInteger(port) || port <= 0) {
    console.error("send-event-email: SMTP_PORT is not a port number");
    return json(500, { sent: false, error: "not configured" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { sent: false, error: "bad request" });
  }
  // EVT-08 § 4.4. EVT-05's shape first, then the invitation's; neither is a 400. `parsed` is whichever
  // it was: its `to` is the request's own address and the only recipient. `logName` and `ids` are what
  // the failure log names and the answer carries — never the address, the token or the body.
  const appUrl = env.APP_URL.replace(/\/+$/, "");
  const event = parseEventEmailRequest(body);
  const invitation = event === null ? parseInvitationEmailRequest(body) : null;
  let parsed: {
    to: string;
    rendered: RenderedEmail;
    logName: string;
    ids: Pick<Answer, "notificationId" | "invitationId">;
  };
  if (event !== null) {
    parsed = {
      to: event.to,
      rendered: renderEventEmail(event, appUrl),
      logName: `notification ${event.notificationId} (${event.kind})`,
      ids: { notificationId: event.notificationId },
    };
  } else if (invitation !== null) {
    parsed = {
      to: invitation.to,
      rendered: renderInvitationEmail(invitation, appUrl),
      logName: `invitation ${invitation.invitationId} (${invitation.kind})`,
      ids: { invitationId: invitation.invitationId },
    };
  } else {
    return json(400, { sent: false, error: "bad request" });
  }
  const { rendered, logName, ids } = parsed;

  try {
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      // 465 is implicit TLS. Any other port would be STARTTLS, which hosted functions cannot reach.
      secure: port === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
    await transport.sendMail({
      from: env.MAIL_FROM,
      to: parsed.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  } catch (error) {
    // An SMTP refusal often quotes the recipient back (`550 … <name@example.com>`), so anything shaped
    // like an address is replaced before it reaches the log.
    const message = (error instanceof Error ? error.message : String(error)).replace(
      /[^\s<>@"']+@[^\s<>@"']+/g,
      "<address>",
    );
    console.error(
      `send-event-email: send failed for ${logName}: ${message}`,
    );
    return json(502, { sent: false, ...ids, error: "send failed" });
  }

  return json(200, { sent: true, ...ids });
});
