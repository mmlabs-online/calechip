import { useState } from "react";
// SOLO, 2026-09-10. `Navigate` for the confirmation-off hand-over — see the branch below for why a
// rendered redirect rather than a `useNavigate` call, and why returning `null` there was wrong.
import { Navigate } from "react-router-dom";
import { AVATAR_CHOICES, DEFAULT_AVATAR, type Failure } from "@/lib/domain/types";
import Avatar from "@/components/Avatar";
// The seam, through its one door. 02-design.md section 6.2: nothing above the seam names an
// implementation — `@/lib/data` resolves it from the environment, and this file must never import
// `./supabase` or `./mock`. The earlier revision imported the real one by hand, which is why the
// end-to-end build raised `supabaseUrl is required.` with nothing on screen.
//
// The hook layer .ai/standards/architecture.md puts between a route and the seam is still skipped:
// a hook would be a thirteenth file, and design section 5 says a thirteenth tips this ticket to L.
// The boundary RULE-02 protects is untouched — no Supabase client is imported here.
import { seam } from "@/lib/data";
// UIE-01. Presentational only, and it is the same card /signin renders — which is what makes the
// segmented control a change of route rather than a change of screen.
import AuthCard, {
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_STACK,
  FORM_ERROR,
  primaryButtonClass,
} from "@/components/AuthCard";
// SOLO, 2026-09-28. The password box with its reveal eye, shared with `/profile`.
import PasswordInput from "@/components/PasswordInput";

// AC-13: `submitted` is terminal. The notice, and nothing after it — no navigation, no session, no
// member read. That is what makes this half of TEA-01 an operation that begins and ends on one screen.
type SignUpFormState =
  | { phase: "editing"; error: Failure | null }
  | { phase: "submitting" }
  | { phase: "submitted" }
  // SOLO, 2026-09-10. The project does not require confirmation, so the seam handed back a live
  // session and this screen is finished. It hands over to `/` — see the branch below.
  | { phase: "signed-in" };

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [state, setState] = useState<SignUpFormState>({ phase: "editing", error: null });

  // The affordance behind AC-8, and an affordance ONLY (ADR-005): `display_name` and `avatar` are
  // `not null` with no default in the migration, and that column shape is the control. Disabling the
  // button saves a round trip and says why; it enforces nothing, because the same request can be
  // issued from anywhere that is not this screen.
  //
  // SOLO, 2026-09-13. **AN EMPTY `public/images/` DOES NOT BLOCK SIGN-UP.** With nothing to pick, the
  // avatar is `DEFAULT_AVATAR` — the same value the admission trigger writes when sign-up carries
  // none — and the gate below stops waiting for a choice nobody can make.
  const chosenAvatar = AVATAR_CHOICES.length === 0 ? DEFAULT_AVATAR : avatar;
  const complete = Boolean(email && password && displayName && chosenAvatar);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || state.phase !== "editing") return;

    setState({ phase: "submitting" });

    // Design section 6.3: after submit the screen reaches exactly one of two terminal states, always,
    // and `signup-submit` is never left disabled without one of them beside it.
    //
    // The catch is the third row of that table and it is not defensive padding. Section 1 says
    // expected failures are RETURNED rather than thrown, which is true of the seam's own failures and
    // is not true of everything the call can do — the Supabase client raises on an unusable
    // configuration before any request leaves. Without this, that throw escaped as an uncaught page
    // error, the phase stayed `submitting`, and the person was left on a disabled button forever.
    try {
      const result = await seam.signUp({ email, password, displayName, avatar: chosenAvatar });

      // AC-5: the success branch is identical whether or not the address was allow-listed. The seam
      // cannot tell the difference and neither can this component — nothing here branches on it.
      //
      // **SOLO, 2026-09-10 — IT NOW BRANCHES ON `needsEmailConfirmation`, AND ON NOTHING ELSE.**
      // AC-5 is untouched by that: `needsEmailConfirmation` is a fact about the PROJECT'S setting,
      // identical for every caller, and it is not the allow-list. A reader checking AC-5 should
      // check that this line still cannot see `entry`, a member row, or a team — and it cannot.
      //
      // **THE SEAM HAS ALWAYS RETURNED THIS AND NOBODY READ IT.** `src/lib/data/supabase.ts:535`
      // derives it as `data.session === null` — what the server actually did — and this component
      // set `submitted` on every success regardless, so a project with Confirm email OFF returned a
      // live session and the person was still told to go and open an email that was never sent, on a
      // TERMINAL screen with `showTabs={false}` and no way forward. That was a defect under the
      // shipped configuration and not only under the new one.
      //
      // WHEN NO CONFIRMATION IS NEEDED the session is already established by the seam, so there is
      // nothing to navigate to: `App.tsx` re-resolves the membership and renders `/` — the week view
      // for an allow-listed joiner, `NotOnATeam` for anybody else (TEA-05's shipped states). This
      // component neither navigates nor reads the member, which is why `signed-in` is not a fourth
      // phase: it is the ABSENCE of a screen, and rendering nothing is how a route hands over.
      if (result.ok) {
        setState(
          result.value.needsEmailConfirmation
            ? { phase: "submitted" }
            : { phase: "signed-in" },
        );
      } else {
        setState({ phase: "editing", error: result.error });
      }
    } catch {
      setState({
        phase: "editing",
        error: { code: "unknown", message: "Sign-up failed. Please try again." },
      });
    }
  }

  // UIE-01 AC-14. THE THIRD STATE OF THE SAME CARD, which is the whole point of routing it through
  // AuthCard: same ground, same card, same title and subtitle, so this reads as the end of the
  // operation rather than as a different screen. `showTabs={false}` is what keeps TEA-01 AC-13's
  // terminality true — a segmented control here would let somebody click away from a terminal state.
  // SOLO, 2026-09-10. The session is live, so this screen is finished and hands over to `/`, which
  // resolves by membership — the week view for an allow-listed joiner, `NotOnATeam` for anybody
  // else (TEA-05's shipped states).
  //
  // **IT MUST NAVIGATE ITSELF, AND THIS WAS GOT WRONG ONCE BEFORE IT WAS GOT RIGHT.** The first
  // attempt returned `null` on the reasoning that `useSession` would re-resolve and the router would
  // replace the screen. It does not: `App.tsx:127-129` says `/signup` is *"reachable in EVERY
  // membership state"* and renders `<SignUp />` unconditionally, so a live session changes nothing
  // about which route matches. The result was a person signed in behind a blank page — caught by
  // driving the real build with the flag off, and by nothing in the suite, because the suite pins
  // the flag on.
  //
  // `<Navigate>` AND NOT `useNavigate` IN THE HANDLER: this is the same shape `/signin` uses one
  // route over for the same situation (`App.tsx:134-142`), a redirect expressed as what the screen
  // renders rather than as a side effect of a click. `replace` so the browser Back button does not
  // return to a sign-up form for an account that now exists.
  if (state.phase === "signed-in") return <Navigate to="/" replace />;

  if (state.phase === "submitted") {
    return (
      <AuthCard tab="signup" showTabs={false}>
        <section data-testid="signup-confirm-notice" className="text-center">
          <h2 className="text-base font-bold text-ink">Check your email</h2>
          <p className="mt-2 text-[13px] text-ink-2">
            We have sent a confirmation link to the address you entered. Open it to finish signing
            up.
          </p>
        </section>
      </AuthCard>
    );
  }

  const submitting = state.phase === "submitting";

  // UIE-01 AC-10: the nine `signup-*` names on this screen are frozen. New controls may add
  // selectors; not one of these may be renamed, because twelve spec files address them.
  return (
    <AuthCard tab="signup">
      <form data-testid="signup-form" onSubmit={onSubmit} className={FIELD_STACK}>
        {/* AC-8 puts the order here, and it is originated rather than transcribed: the reference
            shows no avatar picker and no email field at all. Display name and avatar are the two
            things the person is CHOOSING about themselves, so they lead; the credentials follow. */}
        <label className="block">
          <span className={FIELD_LABEL}>Display name</span>
          <input
            data-testid="signup-display-name"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={FIELD_INPUT}
          />
        </label>

        {/* TEA-01 AC-8: the person supplies both. There is no server to fill them in (ADR-005) and
            no correction screen in v1, so sign-up is the only moment they can be collected.

            UIE-01 AC-9 — THE PICKER SURVIVES THE RESTYLE AS A PICKER. The reference shows no avatar
            selection at all, and removing it would break TEA-01's AC-8, the `complete` gate above
            and four assertions in tests/e2e/tea-01-signup.spec.ts.

            A WRAPPING GRID, NOT A SCROLLING ROW (operator, 2026-09-13). The row it replaced showed
            the platform scrollbar and cut swatches off at both edges. `auto-fill` with a 2.5rem
            minimum fits as many columns as the card allows (six at ~290px) and every image is in
            view, so the first swatch is still where `.first().click()` in that spec expects it.

            `p-1` on the grid is not spacing: the selected swatch's ring sits OUTSIDE its box, and
            without room around the outer swatches it would touch the card's edge.

            `min-w-0` on the fieldset stays: a fieldset carries `min-inline-size: min-content` in the
            UA stylesheet and would otherwise refuse to shrink with the card (AC-16). */}
        <fieldset className="block min-w-0">
          <legend className={FIELD_LABEL}>Avatar</legend>
          {AVATAR_CHOICES.length === 0 ? (
            <div
              data-testid="signup-avatar-default"
              className="flex items-center gap-2 py-1 text-sm text-ink-2"
            >
              <Avatar value={DEFAULT_AVATAR} className="h-11 w-11" />
              <span>The default avatar will be used.</span>
            </div>
          ) : (
            <div
              data-testid="signup-avatar-picker"
              role="radiogroup"
              aria-label="Avatar"
              className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-2 p-1"
            >
              {AVATAR_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  data-testid="signup-avatar-option"
                  data-avatar={choice}
                  aria-label={choice}
                  role="radio"
                  aria-checked={avatar === choice}
                  onClick={() => setAvatar(choice)}
                  className={
                    // AC-9: the selected swatch is distinguished by MORE THAN COLOUR — a ring, which
                    // is a shape, and `aria-checked`, which is what a screen reader gets.
                    "aspect-square w-full max-w-11 justify-self-center overflow-hidden rounded-full bg-field p-[5px] text-lg " +
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink " +
                    (avatar === choice ? "ring-2 ring-ink ring-offset-2 ring-offset-card" : "")
                  }
                >
                  <Avatar value={choice} />
                </button>
              ))}
            </div>
          )}
        </fieldset>

        <label className="block">
          <span className={FIELD_LABEL}>Email</span>
          <input
            data-testid="signup-email"
            type="email"
            required
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

              `autoComplete="new-password"` is UNCHANGED and is not decoration — it is what
              tells a password manager which box this is, and the component requires it for
              that reason rather than defaulting it. */}
          <PasswordInput
            testId="signup-password"
            value={password}
            onChange={setPassword}
            className={FIELD_INPUT}
            autoComplete="new-password"
            required
          />
        </label>

        {/* AC-11: inside the card, between the last field and the button, still announced. */}
        {state.phase === "editing" && state.error ? (
          <p data-testid="signup-error" role="alert" className={FORM_ERROR}>
            {state.error.message}
          </p>
        ) : null}

        <button
          data-testid="signup-submit"
          type="submit"
          disabled={!complete || submitting}
          className={primaryButtonClass({ submitting, disabled: !complete })}
        >
          {submitting ? "Sending…" : "Sign up"}
        </button>
      </form>
    </AuthCard>
  );
}
