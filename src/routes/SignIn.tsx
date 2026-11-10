// TEA-05 — the sign-in screen. 01-plan.md sections 4.4 and 8.
//
// Everything here is an affordance (ADR-005). Authentication is not authorization: this screen
// establishes WHO the caller is, and every policy already written decides what that identity may do.
// It adds no permission and changes no row of the table in .ai/standards/rbac-and-security.md.
//
// On success it renders nothing of its own. The seam notifies, `useSession` re-resolves, and
// `App.tsx` routes away — which is why there is no navigation call anywhere in this file.
//
// RESTYLED BY UIE-01 AND NOTHING BELOW THE SURFACE MOVED (AC-18). The seam call at `signIn(...)`,
// the form state machine, the refusal handling and all four `sign-in-*` selectors are exactly what
// TEA-05 shipped. What changed is the markup around them and the classes on it.
import { useState } from "react";
import type { SignInInput } from "@/lib/data";
import type { Failure, Result, Session } from "@/lib/domain/types";
import AuthCard, {
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_STACK,
  FORM_ERROR,
  primaryButtonClass,
} from "@/components/AuthCard";
// SOLO, 2026-09-28. The password box with its reveal eye, shared with `/profile`.
import PasswordInput from "@/components/PasswordInput";

interface SignInProps {
  signIn(input: SignInInput): Promise<Result<Session>>;
}

// The same shape SignUp.tsx uses. `submitting` is never terminal: every path out of the submit
// handler lands back on `editing`, with or without an error, or the screen is routed away by the
// session change. A disabled button with neither beside it is the failure QA found on TEA-01.
type SignInFormState = { phase: "editing"; error: Failure | null } | { phase: "submitting" };

export default function SignIn({ signIn }: SignInProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<SignInFormState>({ phase: "editing", error: null });

  const complete = Boolean(email && password);
  const submitting = state.phase === "submitting";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || state.phase !== "editing") return;

    setState({ phase: "submitting" });

    try {
      const result = await signIn({ email, password });

      // AC-2 and AC-3. The message is produced in the seam and rendered verbatim here — this screen
      // never composes a sentence of its own about why a sign-in failed, so it cannot accidentally
      // tell an unknown address apart from a wrong password. `invalid_credentials` is one message
      // for both; `email_not_confirmed` is its own, because sending somebody to reset a password
      // that is correct is the more expensive help.
      //
      // On success the state is set back to `editing` and stays on screen for the instant before
      // the routing changes. Leaving it `submitting` would strand the button if the resolution ever
      // failed to arrive.
      setState({ phase: "editing", error: result.ok ? null : result.error });
    } catch {
      // Not defensive padding: expected failures are RETURNED by the seam, and the Supabase client
      // still raises on an unusable configuration before any request leaves.
      setState({
        phase: "editing",
        error: { code: "unknown", message: "Sign-in failed. Please try again." },
      });
    }
  }

  // No `data-testid` on the form itself: 01-plan.md section 8 does not name one, and section 8 is
  // the ONLY channel through which a selector reaches QA (RULE-05). `sign-in-submit` is what that
  // table says asserts "the sign-in screen", for AC-5 and AC-9.
  //
  // UIE-01 AC-10: the four `sign-in-*` names below are frozen. Renaming one would pull twelve spec
  // files into this ticket — eight of them only because each carries a local `signIn(page, email)`
  // helper filling these three ids — and seventeen files is L, which must split.
  return (
    <AuthCard tab="signin">
      <form onSubmit={onSubmit} className={FIELD_STACK}>
        <label className="block">
          <span className={FIELD_LABEL}>Email</span>
          <input
            data-testid="sign-in-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD_INPUT}
          />
        </label>

        <label className="block">
          <span className={FIELD_LABEL}>Password</span>
          {/* SOLO, 2026-09-28 — the reveal eye, on the operator's instruction. The control
              is `src/components/PasswordInput.tsx`, extracted from `Profile.tsx` rather than
              copied: the padding that keeps the typed characters clear of the icon is the
              part that goes wrong when it is written twice.

              `autoComplete="current-password"` is UNCHANGED and is not decoration — it is what
              tells a password manager which box this is, and the component requires it for
              that reason rather than defaulting it. */}
          <PasswordInput
            testId="sign-in-password"
            value={password}
            onChange={setPassword}
            className={FIELD_INPUT}
            autoComplete="current-password"
            required
          />
        </label>

        {/* AC-11: inside the card, between the last field and the button, and still `role="alert"`
            so the refusal is announced rather than only shown. */}
        {state.phase === "editing" && state.error ? (
          <p data-testid="sign-in-error" role="alert" className={FORM_ERROR}>
            {state.error.message}
          </p>
        ) : null}

        <button
          data-testid="sign-in-submit"
          type="submit"
          disabled={!complete || submitting}
          className={primaryButtonClass({ submitting, disabled: !complete })}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthCard>
  );
}

/* THERE IS NOW A LINK TO /signup, AND THIS COMMENT RECORDS THE REVERSAL RATHER THAN THE DECISION IT
   REPLACES. What stood here through TEA-05 said the absence of such a link was deliberate, citing
   that ticket's 01-plan.md section 1 — "nothing else navigates", with the single admin-only
   /allow-list link on the landing screen as the one link the feature row permitted.

   UIE-01 SUPERSEDES IT. The segmented control in AuthCard is that link, in both directions, and
   01-plan.md section 4.5 requires this comment to be rewritten in the same ticket rather than left
   standing to contradict the code beside it — a developer who found it and obeyed it would not
   build AC-4.

   WHY THE REVERSAL IS NOT ADR-LEVEL, which is the part worth keeping: the control adds no
   permission and reveals nothing. /signup is ALREADY reachable by address in every membership state
   (App.tsx:68, ADR-009 — somebody who signed up before being allow-listed has an auth user and no
   member row), so this adds a second route to a destination that was never guarded. It is a static
   link, rendered identically for everyone, before anybody is anybody, and it discloses no fact
   about any address. The guard on /signin itself is untouched. */
